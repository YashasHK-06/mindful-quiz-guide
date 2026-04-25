import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ExamGuard — Secure Online Exam Platform" },
      { name: "description", content: "Proctored online exams with camera monitoring and tab-switch detection" },
      { name: "author", content: "ExamGuard" },
      { property: "og:title", content: "ExamGuard — Secure Online Exam Platform" },
      { property: "og:description", content: "Proctored online exams with camera monitoring and tab-switch detection" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ExamGuard — Secure Online Exam Platform" },
      { name: "twitter:description", content: "Proctored online exams with camera monitoring and tab-switch detection" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2c39e3d6-80be-4de8-8b7a-df5ee0fcb310/id-preview-92f866b8--dbd31707-9168-4e28-ac2c-4921fa91bff0.lovable.app-1777027642202.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2c39e3d6-80be-4de8-8b7a-df5ee0fcb310/id-preview-92f866b8--dbd31707-9168-4e28-ac2c-4921fa91bff0.lovable.app-1777027642202.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
