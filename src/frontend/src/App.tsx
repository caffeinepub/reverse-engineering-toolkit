import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import { BinaryAnalyzer } from "@/pages/BinaryAnalyzer";
import { Checksums } from "@/pages/Checksums";
import { Dashboard } from "@/pages/Dashboard";
import { Deobfuscator } from "@/pages/Deobfuscator";
import { Disassembler } from "@/pages/Disassembler";
import { EntropyHeatmap } from "@/pages/EntropyHeatmap";
import { FileDiff } from "@/pages/FileDiff";
import { HeaderInspector } from "@/pages/HeaderInspector";
import { HexEditor } from "@/pages/HexEditor";
import { ImportTableAnalyzer } from "@/pages/ImportTableAnalyzer";
import { PEResourceExtractor } from "@/pages/PEResourceExtractor";
import { PatternScanner } from "@/pages/PatternScanner";
import { StringExtractor } from "@/pages/StringExtractor";
import { YaraRuleBuilder } from "@/pages/YaraRuleBuilder";
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

const checksumsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/checksums",
  component: Checksums,
});

const deobfuscatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deobfuscator",
  component: Deobfuscator,
});

const fileDiffRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/file-diff",
  component: FileDiff,
});

const yaraRuleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/yara-rule",
  component: YaraRuleBuilder,
});

const hexEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hex-editor",
  component: HexEditor,
});

const entropyHeatmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entropy-heatmap",
  component: EntropyHeatmap,
});

const importTableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import-table",
  component: ImportTableAnalyzer,
});

const peResourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pe-resources",
  component: PEResourceExtractor,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  binaryAnalyzerRoute,
  stringExtractorRoute,
  disassemblerRoute,
  headerInspectorRoute,
  patternScannerRoute,
  checksumsRoute,
  deobfuscatorRoute,
  fileDiffRoute,
  yaraRuleRoute,
  hexEditorRoute,
  entropyHeatmapRoute,
  importTableRoute,
  peResourcesRoute,
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
