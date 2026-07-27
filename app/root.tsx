import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { ErrorBoundary as ErrorBoundaryRoot } from "~/components/error-boundary/error-boundary";

import "./styles/reset.css";
import "./styles/global.css";
import "./styles/theme.css";
import favicon from "/favicon.svg";

export const meta: Route.MetaFunction = () => [
  { title: "Typeface" },
  {
    name: "description",
    content: "Your face in type.",
  },
];

export const links: Route.LinksFunction = () => [
  {
    rel: "icon",
    href: favicon,
    type: "image/svg+xml",
  },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export const ErrorBoundary = ErrorBoundaryRoot;
