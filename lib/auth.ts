import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import * as ldap from "ldapjs";
import { prisma } from "@/lib/prisma";
import { Role, Team } from "@prisma/client";

// ---------------------------------------------------------------------------
// LDAP authentication helper
// Binds to AD with the user's own DN to verify their password.
// ---------------------------------------------------------------------------
async function authenticateWithLdap(
  email: string,
  password: string
): Promise<{ name: string; email: string } | null> {
  const uri = process.env.LDAP_URI!;
  const baseDn = process.env.LDAP_BASE_DN!;
  const bindDn = process.env.LDAP_BIND_DN!;
  const bindPassword = process.env.LDAP_BIND_PASSWORD!;

  return new Promise((resolve) => {
    const client = ldap.createClient({ url: uri });

    // Step 1: bind as service account to search for user DN
    client.bind(bindDn, bindPassword, (bindErr) => {
      if (bindErr) {
        client.destroy();
        resolve(null);
        return;
      }

      const searchOpts: ldap.SearchOptions = {
        filter: `(mail=${email})`,
        scope: "sub",
        attributes: ["dn", "cn", "mail"],
      };

      client.search(baseDn, searchOpts, (searchErr, res) => {
        if (searchErr) {
          client.destroy();
          resolve(null);
          return;
        }

        let userDn: string | null = null;
        let userName: string | null = null;

        res.on("searchEntry", (entry) => {
          userDn = entry.objectName as string;
          const cnAttr = entry.attributes.find((a) => a.type === "cn");
          userName = cnAttr ? (cnAttr.values[0] as string) : email;
        });

        res.on("error", () => {
          client.destroy();
          resolve(null);
        });

        res.on("end", () => {
          if (!userDn) {
            client.destroy();
            resolve(null);
            return;
          }

          // Step 2: bind as the user to verify their password
          client.bind(userDn, password, (userBindErr) => {
            client.destroy();
            if (userBindErr) {
              resolve(null);
            } else {
              resolve({ name: userName!, email });
            }
          });
        });
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Determine auth mode from environment
// If LDAP_URI is set, use LDAP. Otherwise fall back to credentials (demo only).
// ---------------------------------------------------------------------------
const isLdapEnabled = Boolean(process.env.LDAP_URI);
const isCredentialEnabled = Boolean(process.env.ENABLE_CREDENTIAL_AUTH);

if (!isLdapEnabled && !isCredentialEnabled) {
  // Warn loudly at startup — credential auth must be explicitly opted in.
  console.warn(
    "[auth] WARNING: Neither LDAP nor ENABLE_CREDENTIAL_AUTH is configured. " +
      "Set LDAP_URI for production or ENABLE_CREDENTIAL_AUTH=true for demo mode."
  );
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes inactivity timeout
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    // ------------------------------------------------------------------
    // LDAP provider — wraps ldapjs in a CredentialsProvider
    // Active only when LDAP_URI is set.
    // ------------------------------------------------------------------
    ...(isLdapEnabled
      ? [
          CredentialsProvider({
            id: "ldap",
            name: "Active Directory",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              if (!credentials?.email || !credentials?.password) return null;

              const ldapUser = await authenticateWithLdap(
                credentials.email,
                credentials.password
              );
              if (!ldapUser) return null;

              // Upsert user record — AD owns identity, app DB owns role
              const user = await prisma.user.upsert({
                where: { email: ldapUser.email },
                update: { name: ldapUser.name },
                create: {
                  email: ldapUser.email,
                  name: ldapUser.name,
                  // No password stored for LDAP users
                },
              });

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                team: user.team,
              };
            },
          }),
        ]
      : []),

    // ------------------------------------------------------------------
    // Credentials provider — demo / Vercel only.
    // Gate: ENABLE_CREDENTIAL_AUTH=true must be set explicitly.
    // NEVER enable this in a production deployment.
    // ------------------------------------------------------------------
    ...(isCredentialEnabled
      ? [
          CredentialsProvider({
            id: "credentials",
            name: "Email & Password (Demo)",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              if (!credentials?.email || !credentials?.password) return null;

              const user = await prisma.user.findUnique({
                where: { email: credentials.email },
              });

              if (!user || !user.password || !user.isActive) return null;

              const passwordValid = await bcrypt.compare(
                credentials.password,
                user.password
              );

              if (!passwordValid) return null;

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                team: user.team,
              };
            },
          }),
        ]
      : []),
  ],

  events: {
    async signIn({ user }) {
      if (!user.id) return;
      // Update lastLoginAt and write audit log entry — both non-fatal
      await Promise.all([
        prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date() },
        }).catch(() => {}),
        prisma.auditLog.create({
          data: {
            userId:     user.id,
            action:     "USER_LOGIN",
            targetType: "User",
            targetId:   user.id,
            detail:     { email: user.email } as never,
          },
        }).catch(() => {}),
      ]);
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Populated on initial sign-in from the authorize() return value
        token.id = user.id;
        const u = user as { role?: Role; team?: Team | null };
        token.role = u.role ?? Role.SOC_ANALYST;
        token.team = u.team ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.team = (token.team as Team | null | undefined) ?? null;
      }
      return session;
    },
  },
};

// ---------------------------------------------------------------------------
// Augment next-auth types
// ---------------------------------------------------------------------------
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      team: Team | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    team: Team | null;
  }
}
