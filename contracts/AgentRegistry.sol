// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAgentRegistry.sol";

/**
 * @title AgentRegistry
 * @notice ENS-style naming system for AI agents with fee sharing
 * @dev Deployed on Arbitrum Mainnet for LI.FI integration
 *
 * Users register agent names (e.g., "yieldseeker.lifi") and earn fees
 * when others use their agents to generate yield.
 */
contract AgentRegistry is IAgentRegistry {
    // Constants
    uint256 public constant MAX_FEE = 2000; // 20% max fee
    uint256 public constant MIN_NAME_LENGTH = 3;
    uint256 public constant MAX_NAME_LENGTH = 32;

    // Valid agent IDs (a0-a6)
    mapping(string => bool) public validAgentIds;

    // Name => Agent data
    mapping(bytes32 => RegisteredAgent) private agents;

    // Owner => List of registered names (as hashes)
    mapping(address => bytes32[]) private ownerAgents;

    // Track all registered names for enumeration
    bytes32[] private allAgentHashes;

    // Authorized callers (vault contract, etc.)
    mapping(address => bool) public authorizedCallers;

    // Contract owner for admin functions
    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyAgentOwner(string calldata name) {
        bytes32 nameHash = keccak256(bytes(name));
        require(agents[nameHash].owner == msg.sender, "Not agent owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == admin, "Not authorized");
        _;
    }

    constructor() {
        admin = msg.sender;

        // Initialize valid agent IDs
        validAgentIds["a0"] = true; // Route Strategist
        validAgentIds["a1"] = true; // Arbitrage Hunter
        validAgentIds["a2"] = true; // Portfolio Guardian
        validAgentIds["a3"] = true; // Yield Seeker
        validAgentIds["a4"] = true; // Risk Sentinel
        validAgentIds["a5"] = true; // Rebalancer
        validAgentIds["a6"] = true; // Route Executor
    }

    /**
     * @notice Register a new agent name
     * @param name The agent name (e.g., "yieldseeker.lifi")
     * @param agentId The agent ID (a0-a6)
     * @param performanceFee Fee in basis points (500 = 5%)
     */
    function registerAgent(
        string calldata name,
        string calldata agentId,
        uint256 performanceFee
    ) external override {
        require(bytes(name).length >= MIN_NAME_LENGTH, "Name too short");
        require(bytes(name).length <= MAX_NAME_LENGTH, "Name too long");
        require(performanceFee <= MAX_FEE, "Fee too high");
        require(validAgentIds[agentId], "Invalid agent ID");
        require(_isValidName(name), "Invalid characters in name");

        bytes32 nameHash = keccak256(bytes(name));
        require(agents[nameHash].owner == address(0), "Name already registered");

        agents[nameHash] = RegisteredAgent({
            name: name,
            agentId: agentId,
            owner: msg.sender,
            performanceFee: performanceFee,
            totalYieldGenerated: 0,
            totalFeesEarned: 0,
            usageCount: 0,
            active: true,
            registeredAt: block.timestamp
        });

        ownerAgents[msg.sender].push(nameHash);
        allAgentHashes.push(nameHash);

        emit AgentRegistered(name, name, agentId, msg.sender, performanceFee);
    }

    /**
     * @notice Resolve an agent name to its data
     * @param name The agent name to resolve
     * @return The registered agent data
     */
    function resolveAgent(string calldata name) external view override returns (RegisteredAgent memory) {
        bytes32 nameHash = keccak256(bytes(name));
        RegisteredAgent memory agent = agents[nameHash];
        require(agent.owner != address(0), "Agent not found");
        return agent;
    }

    /**
     * @notice Check if a name is available
     * @param name The name to check
     * @return True if available
     */
    function isNameAvailable(string calldata name) external view override returns (bool) {
        if (bytes(name).length < MIN_NAME_LENGTH || bytes(name).length > MAX_NAME_LENGTH) {
            return false;
        }
        if (!_isValidName(name)) {
            return false;
        }
        bytes32 nameHash = keccak256(bytes(name));
        return agents[nameHash].owner == address(0);
    }

    /**
     * @notice Update the performance fee for an agent
     * @param name The agent name
     * @param newFee New fee in basis points
     */
    function updateFee(string calldata name, uint256 newFee) external override onlyAgentOwner(name) {
        require(newFee <= MAX_FEE, "Fee too high");

        bytes32 nameHash = keccak256(bytes(name));
        agents[nameHash].performanceFee = newFee;

        emit AgentUpdated(name, name, newFee);
    }

    /**
     * @notice Transfer agent ownership to a new address
     * @param name The agent name
     * @param newOwner The new owner address
     */
    function transferAgentOwnership(string calldata name, address newOwner) external override onlyAgentOwner(name) {
        require(newOwner != address(0), "Invalid new owner");

        bytes32 nameHash = keccak256(bytes(name));
        address previousOwner = agents[nameHash].owner;

        // Update owner
        agents[nameHash].owner = newOwner;

        // Update owner mappings
        _removeFromOwnerList(previousOwner, nameHash);
        ownerAgents[newOwner].push(nameHash);

        emit OwnershipTransferred(name, name, previousOwner, newOwner);
    }

    /**
     * @notice Record yield generated through an agent (called by vault)
     * @param name The agent name
     * @param yieldAmount The yield amount generated
     */
    function recordYield(string calldata name, uint256 yieldAmount) external override onlyAuthorized {
        bytes32 nameHash = keccak256(bytes(name));
        RegisteredAgent storage agent = agents[nameHash];
        require(agent.owner != address(0), "Agent not found");

        uint256 feeAmount = (yieldAmount * agent.performanceFee) / 10000;

        agent.totalYieldGenerated += yieldAmount;
        agent.totalFeesEarned += feeAmount;
        agent.usageCount += 1;

        emit YieldRecorded(name, name, yieldAmount, feeAmount);
    }

    /**
     * @notice Get all agent names owned by an address
     * @param owner The owner address
     * @return Array of agent names
     */
    function getAgentsByOwner(address owner) external view override returns (string[] memory) {
        bytes32[] memory hashes = ownerAgents[owner];
        string[] memory names = new string[](hashes.length);

        for (uint256 i = 0; i < hashes.length; i++) {
            names[i] = agents[hashes[i]].name;
        }

        return names;
    }

    /**
     * @notice Get total number of registered agents
     * @return Count of registered agents
     */
    function totalAgents() external view returns (uint256) {
        return allAgentHashes.length;
    }

    /**
     * @notice Get agent at index (for enumeration)
     * @param index The index
     * @return The agent data
     */
    function getAgentAtIndex(uint256 index) external view returns (RegisteredAgent memory) {
        require(index < allAgentHashes.length, "Index out of bounds");
        return agents[allAgentHashes[index]];
    }

    /**
     * @notice Activate/deactivate an agent
     * @param name The agent name
     * @param active New active status
     */
    function setAgentActive(string calldata name, bool active) external onlyAgentOwner(name) {
        bytes32 nameHash = keccak256(bytes(name));
        agents[nameHash].active = active;
    }

    /**
     * @notice Add an authorized caller (admin only)
     * @param caller The address to authorize
     */
    function addAuthorizedCaller(address caller) external onlyAdmin {
        authorizedCallers[caller] = true;
    }

    /**
     * @notice Remove an authorized caller (admin only)
     * @param caller The address to remove
     */
    function removeAuthorizedCaller(address caller) external onlyAdmin {
        authorizedCallers[caller] = false;
    }

    /**
     * @notice Transfer admin role
     * @param newAdmin The new admin address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
    }

    // Internal functions

    function _isValidName(string calldata name) internal pure returns (bool) {
        bytes memory nameBytes = bytes(name);
        for (uint256 i = 0; i < nameBytes.length; i++) {
            bytes1 char = nameBytes[i];
            // Allow: a-z, 0-9, -, .
            bool isLowercase = (char >= 0x61 && char <= 0x7A);
            bool isNumber = (char >= 0x30 && char <= 0x39);
            bool isHyphen = (char == 0x2D);
            bool isDot = (char == 0x2E);

            if (!isLowercase && !isNumber && !isHyphen && !isDot) {
                return false;
            }
        }
        return true;
    }

    function _removeFromOwnerList(address owner, bytes32 nameHash) internal {
        bytes32[] storage list = ownerAgents[owner];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == nameHash) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
    }
}
