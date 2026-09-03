# syntax=docker/dockerfile:1

# Build stage: .NET 10 SDK + Node.js 20 for Tailwind CSS compilation
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /source

# Copy the full repo because the demo project references src/ and themes/
COPY . .

# Root devDependencies (postcss + css-has-pseudo plugin), required by
# tools/postcss-oklab.cjs which both demo css builds invoke. Without this,
# `npm run css` fails in Docker with MODULE_NOT_FOUND even though it works
# locally, because locally root node_modules happens to exist.
RUN npm ci

# Pre-seed node_modules so the csproj Tailwind target finds them.
WORKDIR /source/demo/Unpoly.Blazor.Shadcn.Demo
RUN npm ci

WORKDIR /source
RUN dotnet publish demo/Unpoly.Blazor.Shadcn.Demo/Unpoly.Blazor.Shadcn.Demo.csproj \
    -c Release \
    -o /app/publish \
    --nologo

# ------------------------------------------------------------------------------
# Runtime stage: lean ASP.NET 10 runtime image
# ------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

# Render sets $PORT at runtime; default to 10000 for local testing.
# Shell-form is required so the variable is expanded when the container starts.
CMD ASPNETCORE_URLS="http://+:${PORT:-10000}" dotnet Unpoly.Blazor.Shadcn.Demo.dll
