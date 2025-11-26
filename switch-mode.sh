#!/bin/bash

# Script to switch between script mode and hardhat-deploy mode

MODE=$1

if [ -z "$MODE" ]; then
  echo "Usage: ./switch-mode.sh [script|hardhat]"
  echo "  script  - Configure for running e2e test scripts"
  echo "  hardhat - Configure for hardhat deploy commands"
  exit 1
fi

case $MODE in
  script)
    echo "Switching to script mode..."
    
    # Update tsconfig.json for script mode (bundler resolution)
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "sourceMap": true,
    "inlineSources": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
EOF
    
    echo "✓ tsconfig.json updated for script mode"
    echo "You can now run: pnpm e2e"
    ;;
    
  hardhat)
    echo "Switching to hardhat mode..."
    
    # Update tsconfig.json for hardhat mode (nodenext resolution)
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "sourceMap": true,
    "inlineSources": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "./",
    "deploy-helpers"
  ],
  "exclude": ["node_modules"],
  "files": ["./hardhat.config.ts"]
}
EOF
    
    echo "✓ tsconfig.json updated for hardhat mode"
    echo "You can now run: pnpm hardhat deploy"
    ;;
    
  *)
    echo "Error: Invalid mode '$MODE'"
    echo "Usage: ./switch-mode.sh [script|hardhat]"
    exit 1
    ;;
esac
