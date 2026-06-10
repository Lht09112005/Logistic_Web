declare module "swagger-jsdoc" {
  interface Options {
    definition: Record<string, unknown>;
    apis: string[];
  }
  function swaggerJsdoc(options: Options): Record<string, unknown>;
  export = swaggerJsdoc;
}

declare module "swagger-ui-express" {
  import { RequestHandler } from "express";
  interface SwaggerUiOptions {
    customCss?: string;
    customSiteTitle?: string;
    customfavIcon?: string;
  }
  export function setup(
    spec: Record<string, unknown>,
    options?: SwaggerUiOptions
  ): RequestHandler;
  export const serve: RequestHandler[];
}
