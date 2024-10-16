import "@nomicfoundation/hardhat-toolbox";
import { task } from "hardhat/config";
import { Router } from "../typechain-types";

task("upgradeRouter", "Upgrades router").setAction(async (_, hre) => {
  const { ethers } = hre;

  const DeployGovernanceFactory = await ethers.getContractFactory("DeployGovernance", {
    libraries: {
      NewGTokens: await (await ethers.deployContract("NewGTokens")).getAddress(),
      DeployLaunchPair: await (await ethers.deployContract("DeployLaunchPair")).getAddress(),
      GovernanceLib: await (await ethers.deployContract("GovernanceLib")).getAddress(),
    },
  });
  const deployGovernance = await DeployGovernanceFactory.deploy();
  await deployGovernance.waitForDeployment();

  const routerUpgradeFactory = async () =>
    ethers.getContractFactory("Router", {
      libraries: {
        DeployLpToken: await (await ethers.deployContract("DeployLpToken")).getAddress(),
        DeployPair: await (await ethers.deployContract("DeployPair")).getAddress(),
        DeployBasePair: await (await ethers.deployContract("DeployBasePair")).getAddress(),
        DeployEduPair: await (await ethers.deployContract("DeployEduPair")).getAddress(),
        DeployGovernance: await deployGovernance.getAddress(),
      },
    });

  const { deployer } = await hre.getNamedAccounts();
  const router = await ethers.getContract<Router>("Router", deployer);
  const routerAddress = await router.getAddress();

  const routerImplementation = await hre.upgrades.forceImport(routerAddress, await routerUpgradeFactory());

  await hre.run("compile");
  await hre.upgrades.upgradeProxy(routerImplementation, await routerUpgradeFactory(), {
    unsafeAllow: ["external-library-linking"],
    redeployImplementation: "always",
  });

  const { abi, metadata } = await hre.deployments.getExtendedArtifact("Router");
  await hre.deployments.save("Router", { abi, metadata, address: routerAddress });
  await hre.deployments.run("generateTsAbis");

  await hre.run("verify", { address: routerAddress });
});
