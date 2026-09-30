import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string };
    /** Vrai quand un administrateur a ouvert ce compte depuis l'espace d'administration. */
    actingAsAdmin?: boolean;
  }
}
