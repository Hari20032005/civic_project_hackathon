const crypto = require('crypto');

/**
 * Simplified Blockchain Service for Civic Issue Reporter
 * Provides blockchain-like audit trail using cryptographic hashing
 * This is a simplified version for hackathon demo purposes
 */
class BlockchainService {
  constructor() {
    // In-memory storage for blockchain events (for demo purposes)
    this.blockchainEvents = new Map();
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Initialize blockchain service
   * In this simplified version, we just set up the service
   */
  async initialize() {
    console.log('Simplified Blockchain Service initialized');
    console.log('Note: This is a demo version using cryptographic hashing for audit trail');
    return true;
  }

  /**
   * Generate a complaint hash
   * @param {number} complaintId - ID of the complaint
   * @param {string} status - Current status of the complaint
   * @param {number} timestamp - Timestamp of the event (as number)
   * @returns {string} SHA256 hash of the complaint data
   */
  generateComplaintHash(complaintId, status, timestamp) {
    const complaintData = `${complaintId}-${status}-${timestamp}`;
    return crypto.createHash('sha256').update(complaintData).digest('hex');
  }

  /**
   * Log a complaint event (simulated blockchain transaction)
   * @param {number} complaintId - ID of the complaint
   * @param {string} status - Current status of the complaint
   * @param {number} timestamp - Timestamp of the event (as number)
   * @returns {Promise<string>} Simulated transaction hash
   */
  async logComplaintEvent(complaintId, status, timestamp) {
    try {
      // Ensure timestamp is a number
      const timestampNum = typeof timestamp === 'number' ? timestamp : Date.now();
      
      // Generate complaint hash
      const complaintHash = this.generateComplaintHash(complaintId, status, timestampNum);
      
      // Generate a simulated transaction hash
      const txData = `${complaintHash}-${timestampNum}-${Math.random()}`;
      const transactionHash = crypto.createHash('sha256').update(txData).digest('hex').substring(0, 66);
      
      // Store the event (simulating blockchain storage)
      const event = {
        complaintId,
        complaintHash,
        status,
        timestamp: timestampNum,
        transactionHash,
        loggedAt: new Date().toISOString()
      };
      
      this.blockchainEvents.set(complaintHash, event);
      
      console.log('Complaint event logged (simulated):', {
        complaintId,
        status,
        timestamp: timestampNum,
        complaintHash,
        transactionHash
      });
      
      return transactionHash;
    } catch (error) {
      console.error('Error logging complaint event:', error.message);
      throw error;
    }
  }

  /**
   * Verify if a complaint exists in our simulated blockchain
   * @param {number} complaintId - ID of the complaint
   * @param {string} status - Status to verify
   * @param {number} timestamp - Timestamp to verify (as number)
   * @returns {Promise<object|null>} Event data if found, null otherwise
   */
  async verifyComplaint(complaintId, status, timestamp) {
    try {
      // Ensure timestamp is a number
      const timestampNum = typeof timestamp === 'number' ? timestamp : Date.now();
      
      // Generate complaint hash
      const complaintHash = this.generateComplaintHash(complaintId, status, timestampNum);
      
      // Check if event exists
      const event = this.blockchainEvents.get(complaintHash);
      
      if (event) {
        console.log('Complaint verified:', {
          complaintId,
          status,
          timestamp: timestampNum,
          complaintHash,
          transactionHash: event.transactionHash
        });
        
        return event;
      }
      
      console.log('Complaint not found on blockchain:', {
        complaintId,
        status,
        timestamp: timestampNum,
        complaintHash
      });
      
      return null;
    } catch (error) {
      console.error('Error verifying complaint:', error.message);
      return null;
    }
  }

  /**
   * Get all blockchain events (for debugging/demo)
   * @returns {Array} Array of all logged events
   */
  getAllEvents() {
    return Array.from(this.blockchainEvents.values());
  }

  /**
   * Get blockchain info (simulated)
   * @returns {Promise<object>} Simulated blockchain connection info
   */
  async getBlockchainInfo() {
    return {
      connected: true,
      network: 'local-simulation',
      chainId: 1337,
      blockNumber: this.blockchainEvents.size,
      account: '0x0000000000000000000000000000000000000000',
      balance: '1000 ETH (simulated)',
      eventsLogged: this.blockchainEvents.size
    };
  }
}

// Export singleton instance
module.exports = new BlockchainService();