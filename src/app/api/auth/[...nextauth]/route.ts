import NextAuth from 'next-auth';
import { socialAuthOptions } from '@/lib/social-auth';

const handler = NextAuth(socialAuthOptions);

export { handler as GET, handler as POST };
