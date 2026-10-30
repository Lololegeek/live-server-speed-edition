import { localTarget } from "../core/network";
export interface ApiRoute {
  prefix: string;
  target: string;
  stripPrefix?: boolean;
}
export function apiRoutes(routes: ApiRoute[]) {
  return routes
    .map((route) => {
      if (
        !/^\/[a-zA-Z0-9_/-]+$/.test(route.prefix) ||
        route.prefix.includes("//") ||
        route.prefix.endsWith("/")
      )
        throw new Error("API prefix must look like /api or /backend/v1");
      const target = localTarget(route.target);
      if (
        target.pathname !== "/" ||
        target.search ||
        target.hash ||
        route.prefix.startsWith("/__live_server_se")
      )
        throw new Error(
          "Use a backend origin without a path and a non-reserved prefix.",
        );
      return { ...route, target };
    })
    .sort((a, b) => b.prefix.length - a.prefix.length);
}
