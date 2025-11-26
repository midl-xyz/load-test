# Dual-Mode Configuration Guide

This repository supports two modes of operation:

## 🎯 Modes

### 1. **Script Mode** (E2E Testing)
For running the e2e test scripts using `tsx`.

**Module Resolution:** `bundler` (optimal for script execution)

### 2. **Hardhat Mode** (Contract Deployment)
For using `hardhat-deploy` to deploy contracts.

**Module Resolution:** `nodenext` (required for Hardhat ESM plugins)

---

## 🚀 Quick Start

### Running E2E Tests
```bash
# Option 1: Auto-switch mode and run
pnpm test:e2e

# Option 2: Manual mode switch
pnpm mode:script
pnpm e2e
```

### Deploying Contracts
```bash
# Option 1: Auto-switch mode and deploy
pnpm hh:deploy

# Option 2: Auto-switch and reset deployments
pnpm hh:deploy:reset

# Option 3: Manual mode switch
pnpm mode:hardhat
pnpm hardhat deploy
```

---

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm e2e` | Run e2e test script (assumes script mode) |
| `pnpm test:e2e` | Switch to script mode + run e2e tests |
| `pnpm hh:deploy` | Switch to hardhat mode + deploy contracts |
| `pnpm hh:deploy:reset` | Switch to hardhat mode + deploy with reset |
| `pnpm mode:script` | Manually switch to script mode |
| `pnpm mode:hardhat` | Manually switch to hardhat mode |

---

## 🔧 Manual Mode Switching

If you prefer to switch modes manually:

```bash
# Switch to script mode
./switch-mode.sh script

# Switch to hardhat mode
./switch-mode.sh hardhat
```

---

## ⚙️ What Changes Between Modes?

The mode switching script modifies `tsconfig.json`:

**Script Mode:**
- `"module": "esnext"`
- `"moduleResolution": "bundler"`
- Optimized for TypeScript execution via `tsx`

**Hardhat Mode:**
- `"module": "nodenext"`
- `"moduleResolution": "nodenext"`
- Required for Hardhat ESM plugins to resolve correctly

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'hardhat/config'"
→ You need to be in **hardhat mode**. Run: `pnpm mode:hardhat`

### Error: Module resolution issues with test scripts
→ You need to be in **script mode**. Run: `pnpm mode:script`

### Forgot which mode you're in?
Check your `tsconfig.json`:
- `"moduleResolution": "bundler"` = script mode
- `"moduleResolution": "nodenext"` = hardhat mode

---

## 📋 Environment Variables

Make sure your `.env` file has:
- `MNEMONIC` - Your wallet mnemonic (note: not MNEMOMIC!)
- `GETH_URL` - RPC endpoint
- `MEMPOOL_URL` - Mempool API URL
- `MAESTRO_URL` - Maestro provider URL
- Other environment-specific variables

---

## 💡 Best Practices

1. **Always use the npm scripts** (`pnpm deploy`, `pnpm test:e2e`) - they handle mode switching automatically
2. **Commit tsconfig.json in script mode** - This is the default for running tests
3. **Don't manually edit tsconfig.json** - Use the mode switching script instead
4. **Check mode before running manual commands** - Avoids confusing errors

---

## 🔄 Workflow Examples

### Daily Development (E2E Testing)
```bash
# Just run tests - mode switches automatically
pnpm test:e2e
```

### Contract Deployment
```bash
# Deploy contracts - mode switches automatically
pnpm hh:deploy
```

### Mixed Workflow
```bash
# Deploy contracts
pnpm hh:deploy

# Run e2e tests (will auto-switch back)
pnpm test:e2e

# Deploy again (will auto-switch back)
pnpm hh:deploy
```

The scripts handle all the switching for you! 🎉
