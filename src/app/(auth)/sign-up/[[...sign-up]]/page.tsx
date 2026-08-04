import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Effortlessly create an account through our intuitive sign-up process.',
};

export default function SignUpPage() {
  return <SignUp path="/sign-up" />;
}
