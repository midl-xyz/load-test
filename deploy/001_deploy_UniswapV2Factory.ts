import type { DeployFunction } from "hardhat-deploy/types";
import { zeroAddress } from "viem";

const deploy: DeployFunction = async ({ midl }) => {
  console.log("Starting deployment process...");

  await midl.initialize();

  await midl.deploy("UniswapV2Factory", { args: [zeroAddress] });

  await midl.execute();
};

deploy.tags = ["main", "UniswapV2Factory"];

export default deploy;

