// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ComplaintAudit
 * @dev Smart contract for logging complaint events on the blockchain
 * This contract provides an audit trail for civic issue reports
 */
contract ComplaintAudit {
    // Event structure for complaint logging
    event ComplaintEvent(
        bytes32 indexed complaintHash,
        string status,
        uint256 timestamp,
        address indexed reporter
    );

    // Store all complaint events
    mapping(bytes32 => ComplaintEventLog) public complaintLogs;
    
    // Structure to store complaint event data
    struct ComplaintEventLog {
        bytes32 complaintHash;
        string status;
        uint256 timestamp;
        address reporter;
        bool exists;
    }

    // Array to keep track of all complaint hashes for enumeration
    bytes32[] public complaintHashes;

    /**
     * @dev Log a complaint event on the blockchain
     * @param complaintHash Unique hash identifying the complaint
     * @param status Current status of the complaint
     * @param timestamp Timestamp of the event
     */
    function logEvent(
        bytes32 complaintHash,
        string memory status,
        uint256 timestamp
    ) public {
        // Create and emit the event
        emit ComplaintEvent(complaintHash, status, timestamp, msg.sender);
        
        // Store the event data
        complaintLogs[complaintHash] = ComplaintEventLog({
            complaintHash: complaintHash,
            status: status,
            timestamp: timestamp,
            reporter: msg.sender,
            exists: true
        });
        
        // Add to the array of hashes
        complaintHashes.push(complaintHash);
    }

    /**
     * @dev Get the total number of logged complaints
     * @return Number of complaints logged
     */
    function getComplaintCount() public view returns (uint256) {
        return complaintHashes.length;
    }

    /**
     * @dev Get complaint hash by index
     * @param index Index of the complaint hash
     * @return Complaint hash at the given index
     */
    function getComplaintHashAtIndex(uint256 index) public view returns (bytes32) {
        require(index < complaintHashes.length, "Index out of bounds");
        return complaintHashes[index];
    }

    /**
     * @dev Check if a complaint exists
     * @param complaintHash Hash of the complaint to check
     * @return Boolean indicating if complaint exists
     */
    function complaintExists(bytes32 complaintHash) public view returns (bool) {
        return complaintLogs[complaintHash].exists;
    }
}