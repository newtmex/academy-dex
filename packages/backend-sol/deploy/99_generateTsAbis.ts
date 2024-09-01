/**
 * MIT License
 *
 * Copyright (c) 2023 BuidlGuidl
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * DON'T MODIFY OR DELETE THIS SCRIPT (unless you know what you're doing)
 *
 * This script generates the file containing the contracts Abi definitions.
 * These definitions are used to derive the types needed in the custom scaffold-eth hooks, for example.
 * This script should run as the last deploy script.
 */

import * as fs from "fs";
import prettier from "prettier";
import { DeployFunction } from "hardhat-deploy/types";

const generatedContractComment = `
/**
 * You should not edit it manually or your changes might be overwritten.
 */
`;

const DEPLOYMENTS_DIR = "./deployments";
const ARTIFACTS_DIR = "./artifacts";

function getDirectories(path: string) {
  return fs
    .readdirSync(path, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

function getContractNames(path: string) {
  return fs
    .readdirSync(path, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith(".json"))
    .map(dirent => dirent.name.split(".")[0]);
}

function getActualSourcesForContract(sources: Record<string, any>, contractName: string) {
  for (const sourcePath of Object.keys(sources)) {
    const sourceName = sourcePath.split("/").pop()?.split(".sol")[0];
    if (sourceName === contractName) {
      const contractContent = sources[sourcePath].content as string;
      const regex = /contract\s+(\w+)\s+is\s+([^{}]+)\{/;
      const match = contractContent.match(regex);

      if (match) {
        const inheritancePart = match[2];
        // Split the inherited contracts by commas to get the list of inherited contracts
        const inheritedContracts = inheritancePart.split(",").map(contract => `${contract.trim()}.sol`);

        return inheritedContracts;
      }
      return [];
    }
  }
  return [];
}

function getInheritedFunctions(sources: Record<string, any>, contractName: string) {
  const actualSources = getActualSourcesForContract(sources, contractName);
  const inheritedFunctions = {} as Record<string, any>;

  for (const sourceContractName of actualSources) {
    const sourcePath = Object.keys(sources).find(key => key.includes(`/${sourceContractName}`));
    if (sourcePath) {
      const sourceName = sourcePath?.split("/").pop()?.split(".sol")[0];
      const { abi } = JSON.parse(fs.readFileSync(`${ARTIFACTS_DIR}/${sourcePath}/${sourceName}.json`).toString());
      for (const functionAbi of abi) {
        if (functionAbi.type === "function") {
          inheritedFunctions[functionAbi.name] = sourcePath;
        }
      }
    }
  }

  return inheritedFunctions;
}

function getContractDataFromDeployments() {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    throw Error("At least one other deployment script should exist to generate an actual contract.");
  }
  const output = {} as Record<string, any>;
  for (const chainName of getDirectories(DEPLOYMENTS_DIR)) {
    const chainId = fs.readFileSync(`${DEPLOYMENTS_DIR}/${chainName}/.chainId`).toString();
    const contracts = {} as Record<string, any>;
    for (const contractName of getContractNames(`${DEPLOYMENTS_DIR}/${chainName}`)) {
      const { abi, address, metadata } = JSON.parse(
        fs.readFileSync(`${DEPLOYMENTS_DIR}/${chainName}/${contractName}.json`).toString(),
      );
      const inheritedFunctions = getInheritedFunctions(JSON.parse(metadata).sources, contractName);
      contracts[contractName] = { address, abi, inheritedFunctions };
    }
    output[chainId] = contracts;
  }
  return output;
}

/**
 * Generates the TypeScript contract definition file based on the json output of the contract deployment scripts
 * This script should be run last.
 */
const generateTsAbis: DeployFunction = async function () {
  const TARGET_DIR = "../academy-dex-ui/contracts/";
  const allContractsData = getContractDataFromDeployments();

  const fileContent = Object.entries(allContractsData).reduce((content, [chainId, chainConfig]) => {
    return `${content}${parseInt(chainId).toFixed(0)}:${JSON.stringify(chainConfig, null, 2)},`;
  }, "");

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR);
  }
  const formattedContent = await prettier.format(
    `${generatedContractComment} import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract"; \n\n
 const deployedContracts = {${fileContent}} as const; \n\n export default deployedContracts satisfies GenericContractsDeclaration`,
    {
      parser: "typescript",
    },
  );
  fs.writeFileSync(`${TARGET_DIR}deployedContracts.ts`, formattedContent);

  console.log(`📝 Updated TypeScript contract definition file on ${TARGET_DIR}deployedContracts.ts`);
};

export default generateTsAbis;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags generateTsAbis
generateTsAbis.tags = ["generateTsAbis"];

generateTsAbis.runAtTheEnd = true;
