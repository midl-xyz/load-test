import type { DeployFunction } from "hardhat-deploy/types";
import { maxUint256 } from "viem";

const deploy: DeployFunction = async ({ midl }) => {
  await midl.initialize();

  await midl.deploy("GoldERC20", { args: [
    maxUint256
  ] });

  await midl.execute();
};

deploy.tags = ["main", "GoldERC20"];

export default deploy;

