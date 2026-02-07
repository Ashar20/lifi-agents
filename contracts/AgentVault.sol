// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAgentRegistry.sol";

/**
 * @title AgentVault
 * @notice Vault for deposits via named agents with automatic fee splitting
 * @dev Integrates with AgentRegistry for fee routing
 *
 * Flow:
 * 1. User deposits via agent: depositViaAgent("yieldseeker.lifi", 1000 USDC)
 * 2. Funds tracked per user per agent
 * 3. On harvest: fees split between agent owner and user
 */
contract AgentVault {
    // USDC on Arbitrum
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    // Registry reference
    IAgentRegistry public immutable registry;

    // User deposit tracking
    struct UserDeposit {
        uint256 principal;
        uint256 depositTime;
        uint256 lastHarvestTime;
        uint256 totalYieldClaimed;
        uint256 totalFeesPaid;
    }

    // User => AgentName => Deposit
    mapping(address => mapping(bytes32 => UserDeposit)) public deposits;

    // Agent => Total deposits
    mapping(bytes32 => uint256) public agentTotalDeposits;

    // Accumulated fees per agent owner
    mapping(address => uint256) public pendingFees;

    // Events
    event DepositViaAgent(
        address indexed user,
        string agentName,
        uint256 amount,
        uint256 timestamp
    );

    event YieldHarvested(
        address indexed user,
        string agentName,
        uint256 grossYield,
        uint256 fee,
        uint256 netYield
    );

    event Withdrawal(
        address indexed user,
        string agentName,
        uint256 amount
    );

    event FeesClaimed(
        address indexed owner,
        uint256 amount
    );

    constructor(address _registry) {
        registry = IAgentRegistry(_registry);
    }

    /**
     * @notice Deposit funds via a named agent
     * @param agentName The agent name (e.g., "yieldseeker.lifi")
     * @param amount Amount to deposit (in USDC, 6 decimals)
     */
    function depositViaAgent(string calldata agentName, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        // Verify agent exists and is active
        IAgentRegistry.RegisteredAgent memory agent = registry.resolveAgent(agentName);
        require(agent.active, "Agent not active");

        bytes32 nameHash = keccak256(bytes(agentName));

        // Transfer USDC from user
        (bool success,) = USDC.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                msg.sender,
                address(this),
                amount
            )
        );
        require(success, "Transfer failed");

        // Update user deposit
        UserDeposit storage deposit = deposits[msg.sender][nameHash];
        deposit.principal += amount;
        if (deposit.depositTime == 0) {
            deposit.depositTime = block.timestamp;
        }
        deposit.lastHarvestTime = block.timestamp;

        // Update agent totals
        agentTotalDeposits[nameHash] += amount;

        emit DepositViaAgent(msg.sender, agentName, amount, block.timestamp);
    }

    /**
     * @notice Harvest yield and split fees
     * @param agentName The agent name
     * @param yieldAmount The yield earned (would come from yield source in production)
     *
     * NOTE: In production, this would integrate with actual yield protocols.
     * For now, it demonstrates the fee splitting mechanism.
     */
    function harvestYield(string calldata agentName, uint256 yieldAmount) external {
        bytes32 nameHash = keccak256(bytes(agentName));
        UserDeposit storage deposit = deposits[msg.sender][nameHash];
        require(deposit.principal > 0, "No deposit found");

        // Get agent fee rate
        IAgentRegistry.RegisteredAgent memory agent = registry.resolveAgent(agentName);

        // Calculate fee split
        uint256 fee = (yieldAmount * agent.performanceFee) / 10000;
        uint256 netYield = yieldAmount - fee;

        // Update deposit tracking
        deposit.totalYieldClaimed += netYield;
        deposit.totalFeesPaid += fee;
        deposit.lastHarvestTime = block.timestamp;

        // Accumulate fee for agent owner
        pendingFees[agent.owner] += fee;

        // Record yield in registry
        registry.recordYield(agentName, yieldAmount);

        // Transfer net yield to user
        if (netYield > 0) {
            (bool success,) = USDC.call(
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    msg.sender,
                    netYield
                )
            );
            require(success, "Yield transfer failed");
        }

        emit YieldHarvested(msg.sender, agentName, yieldAmount, fee, netYield);
    }

    /**
     * @notice Withdraw principal
     * @param agentName The agent name
     * @param amount Amount to withdraw
     */
    function withdraw(string calldata agentName, uint256 amount) external {
        bytes32 nameHash = keccak256(bytes(agentName));
        UserDeposit storage deposit = deposits[msg.sender][nameHash];
        require(deposit.principal >= amount, "Insufficient balance");

        deposit.principal -= amount;
        agentTotalDeposits[nameHash] -= amount;

        // Transfer USDC back to user
        (bool success,) = USDC.call(
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                msg.sender,
                amount
            )
        );
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, agentName, amount);
    }

    /**
     * @notice Claim accumulated fees (for agent owners)
     */
    function claimFees() external {
        uint256 amount = pendingFees[msg.sender];
        require(amount > 0, "No fees to claim");

        pendingFees[msg.sender] = 0;

        // Transfer fees to owner
        (bool success,) = USDC.call(
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                msg.sender,
                amount
            )
        );
        require(success, "Fee claim failed");

        emit FeesClaimed(msg.sender, amount);
    }

    /**
     * @notice Get user deposit info for an agent
     * @param user The user address
     * @param agentName The agent name
     * @return The deposit info
     */
    function getUserDeposit(address user, string calldata agentName)
        external
        view
        returns (UserDeposit memory)
    {
        bytes32 nameHash = keccak256(bytes(agentName));
        return deposits[user][nameHash];
    }

    /**
     * @notice Get total deposits for an agent
     * @param agentName The agent name
     * @return Total deposits
     */
    function getAgentDeposits(string calldata agentName) external view returns (uint256) {
        bytes32 nameHash = keccak256(bytes(agentName));
        return agentTotalDeposits[nameHash];
    }

    /**
     * @notice Get pending fees for an owner
     * @param owner The owner address
     * @return Pending fee amount
     */
    function getPendingFees(address owner) external view returns (uint256) {
        return pendingFees[owner];
    }
}
