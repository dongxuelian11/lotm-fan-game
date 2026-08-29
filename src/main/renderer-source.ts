import { pathToFileURL } from "node:url";

const ALLOWED_DEV_SERVER_URL = "http://127.0.0.1:5173/";

export interface RendererSourceOptions {
  readonly isPackaged: boolean;
  readonly devServerUrl: string | undefined;
  readonly rendererPath: string;
}

export type RendererLoadPlan =
  | {
      readonly kind: "local-file";
      readonly rendererPath: string;
      readonly allowedNavigationUrl: string;
    }
  | {
      readonly kind: "dev-server";
      readonly devServerUrl: string;
      readonly allowedNavigationUrl: string;
    };

export function resolveRendererLoadPlan(options: RendererSourceOptions): RendererLoadPlan {
  const localPlan: RendererLoadPlan = {
    kind: "local-file",
    rendererPath: options.rendererPath,
    allowedNavigationUrl: pathToFileURL(options.rendererPath).toString(),
  };

  if (options.isPackaged || !isAllowedDevelopmentUrl(options.devServerUrl)) {
    return localPlan;
  }

  return {
    kind: "dev-server",
    devServerUrl: ALLOWED_DEV_SERVER_URL,
    allowedNavigationUrl: ALLOWED_DEV_SERVER_URL,
  };
}

function isAllowedDevelopmentUrl(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.origin === "http://127.0.0.1:5173" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}
