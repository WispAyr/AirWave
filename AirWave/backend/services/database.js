const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.messagesFile = path.join(this.dataDir, 'messages.jsonl');
    this.statsFile = path.join(this.dataDir, 'stats.json');
    this.initialize();
  }

  initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize stats file if it doesn't exist
    if (!fs.existsSync(this.statsFile)) {
      this.saveStats({
        totalMessages: 0,
        byCategory: {},
        byAirline: {},
        byDate: {},
        startTime: new Date().toISOString()
      });
    }
  }

  saveMessage(message) {
    try {
      // Append message to JSONL file (one JSON object per line)
      const line = JSON.stringify(message) + '\n';
      fs.appendFileSync(this.messagesFile, line, 'utf8');
      this.updateStats(message);
      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  }

  updateStats(message) {
    try {
      const stats = this.getStats();
      
      stats.totalMessages++;
      
      // Update category stats
      if (message.category) {
        stats.byCategory[message.category] = (stats.byCategory[message.category] || 0) + 1;
      }
      
      // Update airline stats
      if (message.airline) {
        stats.byAirline[message.airline] = (stats.byAirline[message.airline] || 0) + 1;
      }
      
      // Update date stats
      const date = new Date(message.timestamp).toISOString().split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
      
      this.saveStats(stats);
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  getStats() {
    try {
      const data = fs.readFileSync(this.statsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {
        totalMessages: 0,
        byCategory: {},
        byAirline: {},
        byDate: {},
        startTime: new Date().toISOString()
      };
    }
  }

  saveStats(stats) {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  getRecentMessages(limit = 100) {
    try {
      if (!fs.existsSync(this.messagesFile)) {
        return [];
      }

      const lines = fs.readFileSync(this.messagesFile, 'utf8').trim().split('\n');
      const messages = lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse();

      return messages;
    } catch (error) {
      console.error('Error reading messages:', error);
      return [];
    }
  }

  searchMessages(query) {
    try {
      if (!fs.existsSync(this.messagesFile)) {
        return [];
      }

      const lines = fs.readFileSync(this.messagesFile, 'utf8').trim().split('\n');
      const messages = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .filter(msg => {
          // Simple search implementation
          const searchStr = JSON.stringify(msg).toLowerCase();
          return searchStr.includes(query.toLowerCase());
        });

      return messages;
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  clearOldMessages(daysToKeep = 7) {
    try {
      if (!fs.existsSync(this.messagesFile)) {
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const lines = fs.readFileSync(this.messagesFile, 'utf8').trim().split('\n');
      const recentLines = lines.filter(line => {
        try {
          const msg = JSON.parse(line);
          return new Date(msg.timestamp) > cutoffDate;
        } catch {
          return false;
        }
      });

      fs.writeFileSync(this.messagesFile, recentLines.join('\n') + '\n', 'utf8');
      console.log(`🗑️  Cleaned up messages older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Error clearing old messages:', error);
    }
  }
}

module.exports = Database;

