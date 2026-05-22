import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type OnboardingShellProps = {
  step: 1 | 2 | 3;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function OnboardingShell({ step, title, description, children }: OnboardingShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Step {step} of 3
          </p>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
