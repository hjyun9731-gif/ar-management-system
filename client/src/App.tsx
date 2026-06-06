import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import BillingCandidates from "./pages/BillingCandidates";
import BillingApproval from "./pages/BillingApproval";
import ClosureEvents from "./pages/ClosureEvents";
import BillingRecords from "./pages/BillingRecords";
import SyncLogs from "./pages/SyncLogs";

function Router() {
  return (
    <Switch>
      <Route path={"/"} nest>
        {() => (
          <DashboardLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/candidates" component={BillingCandidates} />
              <Route path="/approval" component={BillingApproval} />
              <Route path="/closures" component={ClosureEvents} />
              <Route path="/billing-records" component={BillingRecords} />
              <Route path="/sync-logs" component={SyncLogs} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        )}
      </Route>
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
