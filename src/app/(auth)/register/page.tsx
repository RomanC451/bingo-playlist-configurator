import { RegisterForm } from "@/app/(auth)/register/RegisterForm";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Invalid input",
  exists: "Email already registered",
  avatar: "Please select an avatar",
  signin: "Account created but sign-in failed. Try logging in.",
};

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Registration failed" : null;

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-zinc-500">Register to manage bingo sessions.</p>

      <RegisterForm errorMessage={errorMessage} />
    </div>
  );
}
