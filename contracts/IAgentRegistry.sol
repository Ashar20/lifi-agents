// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAgentRegistry
 * @notice Interface for the Agent Registry - ENS-style naming for AI agents
 */
interface IAgentRegistry {
    struct RegisteredAgent {
        string name;              // "yieldseeker.lifi"
        string agentId;           // "a3"
        address owner;            // Fee recipient
        uint256 performanceFee;   // Basis points (500 = 5%)
        uint256 totalYieldGenerated;
        uint256 totalFeesEarned;
        uint256 usageCount;
        bool active;
        uint256 registeredAt;
    }

    event AgentRegistered(
        string indexed nameHash,
        string name,
        string agentId,
        address indexed owner,
        uint256 performanceFee
    );

    event AgentUpdated(
        string indexed nameHash,
        string name,
        uint256 newFee
    );

    event OwnershipTransferred(
        string indexed nameHash,
        string name,
        address indexed previousOwner,
        address indexed newOwner
    );

    event YieldRecorded(
        string indexed nameHash,
        string name,
        uint256 yieldAmount,
        uint256 feeAmount
    );

    function registerAgent(
        string calldata name,
        string calldata agentId,
        uint256 performanceFee
    ) external;

    function resolveAgent(string calldata name) external view returns (RegisteredAgent memory);

    function isNameAvailable(string calldata name) external view returns (bool);

    function updateFee(string calldata name, uint256 newFee) external;

    function transferAgentOwnership(string calldata name, address newOwner) external;

    function recordYield(string calldata name, uint256 yieldAmount) external;

    function getAgentsByOwner(address owner) external view returns (string[] memory);
}
