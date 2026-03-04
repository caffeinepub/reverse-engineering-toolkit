import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { BinaryAnalyzer } from "@/pages/BinaryAnalyzer";
import { Dashboard } from "@/pages/Dashboard";
import { Disassembler } from "@/pages/Disassembler";
import { HeaderInspector } from "@/pages/HeaderInspector";
import { PatternScanner } from "@/pages/PatternScanner";
import { StringExtractor } from "@/pages/StringExtractor";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

// Root route with Layout
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Layout>
        <Outlet />
      </Layout>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "font-mono text-xs border-border bg-card",
            title: "text-foreground",
            description: "text-muted-foreground",
          },
        }}
      />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});

const binaryAnalyzerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/binary-analyzer",
  component: BinaryAnalyzer,
});

const stringExtractorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/string-extractor",
  component: StringExtractor,
});

const disassemblerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/disassembler",
  component: Disassembler,
});

const headerInspectorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/header-inspector",
  component: HeaderInspector,
});

const patternScannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pattern-scanner",
  component: PatternScanner,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  binaryAnalyzerRoute,
  stringExtractorRoute,
  disassemblerRoute,
  headerInspectorRoute,
  patternScannerRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
