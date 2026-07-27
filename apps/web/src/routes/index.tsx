import { DashboardPage } from "@/pages/dashboard";
import { EcosystemPage } from "@/pages/ecosystem/EcosystemPage";
import { ProtocolDetailPage, RankingsPage } from "@/pages/protocols";
import { TokensPage, TokenDetailPage } from "@/pages/tokens";
import { StablecoinsPage } from "@/pages/stablecoins/StablecoinsPage";
import { NftsPage } from "@/pages/nfts/NftsPage";
import { BridgesPage } from "@/pages/bridges/BridgesPage";
import { ContractsPage } from "@/pages/contracts/ContractsPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import {
  ExplorerPage,
  BlocksPage,
  TransactionsPage,
  AddressesPage,
} from "@/pages/explorer";
import {
  WalletTrackerPage,
  ComparePage,
  AlertsPage,
  WatchlistPage,
  SettingsPage,
} from "@/pages/tools";
import { SearchPage } from "@/pages/search/SearchPage";
import { AboutPage } from "@/pages/meta/AboutPage";
import { ApiDocsPage } from "@/pages/meta/ApiDocsPage";
import { paths } from "./paths";
import { Navigate, Route, Routes } from "react-router-dom";

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.home} element={<DashboardPage />} />
      <Route path={paths.ecosystem} element={<EcosystemPage />} />
      <Route path={paths.protocols} element={<Navigate to={paths.ecosystem} replace />} />
      <Route path="/protocols/:slug" element={<ProtocolDetailPage />} />
      <Route path={paths.rankings} element={<RankingsPage />} />
      <Route path={paths.tokens} element={<TokensPage />} />
      <Route path="/tokens/:address" element={<TokenDetailPage />} />
      <Route path={paths.stablecoins} element={<StablecoinsPage />} />
      <Route path={paths.nfts} element={<NftsPage />} />
      <Route path={paths.bridges} element={<BridgesPage />} />
      <Route path={paths.contracts} element={<ContractsPage />} />
      <Route path={paths.analytics} element={<AnalyticsPage />} />
      <Route path={paths.explorer} element={<ExplorerPage />} />
      <Route path={paths.blocks} element={<BlocksPage />} />
      <Route path={paths.transactions} element={<TransactionsPage />} />
      <Route path={paths.addresses} element={<AddressesPage />} />
      <Route path={paths.walletTracker} element={<WalletTrackerPage />} />
      <Route path={paths.compare} element={<ComparePage />} />
      <Route path={paths.alerts} element={<AlertsPage />} />
      <Route path={paths.watchlist} element={<WatchlistPage />} />
      <Route path={paths.settings} element={<SettingsPage />} />
      <Route path={paths.search} element={<SearchPage />} />
      <Route path={paths.about} element={<AboutPage />} />
      <Route path={paths.apiDocs} element={<ApiDocsPage />} />

      <Route path="/charts" element={<Navigate to={paths.analytics} replace />} />
      <Route path="/leaderboards" element={<Navigate to={paths.rankings} replace />} />
      <Route path="/blocks" element={<Navigate to={paths.blocks} replace />} />
      <Route path="/transactions" element={<Navigate to={paths.transactions} replace />} />
      <Route path="/addresses" element={<Navigate to={paths.addresses} replace />} />
      <Route path="/wallet-tracker" element={<Navigate to={paths.walletTracker} replace />} />
      <Route path="/compare" element={<Navigate to={paths.compare} replace />} />
      <Route path="/alerts" element={<Navigate to={paths.alerts} replace />} />
      <Route path="/watchlist" element={<Navigate to={paths.watchlist} replace />} />
      <Route path="/api-docs" element={<Navigate to={paths.apiDocs} replace />} />

      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Routes>
  );
}
