const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      strict: false,
      allowUnionTypes: true,
      validateSchema: false // Don't validate meta-schema
    });
    addFormats(this.ajv);
    this.schemas = new Map();
    this.loadSchemas();
  }

  loadSchemas() {
    const schemaDir = path.join(__dirname, '../../aviation_data_model_v1.0/schemas');
    
    try {
      const files = fs.readdirSync(schemaDir);
      
      files.forEach(file => {
        if (file.endsWith('.schema.json')) {
          const schemaPath = path.join(schemaDir, file);
          const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
          const schemaName = file.replace('.schema.json', '');
          
          this.schemas.set(schemaName, schema);
          this.ajv.addSchema(schema, schemaName);
        }
      });
      
      console.log(`✅ Loaded ${this.schemas.size} validation schemas`);
    } catch (error) {
      console.error('Error loading schemas:', error);
    }
  }

  validate(schemaName, data) {
    const validate = this.ajv.getSchema(schemaName);
    
    if (!validate) {
      return {
        valid: false,
        errors: [`Schema '${schemaName}' not found`]
      };
    }

    const valid = validate(data);
    
    return {
      valid,
      errors: valid ? [] : validate.errors
    };
  }

  validateACARSMessage(message) {
    // Determine message type and validate accordingly
    const messageType = this.detectMessageType(message);
    
    if (messageType) {
      return this.validate(messageType, message);
    }
    
    // Generic validation
    return { valid: true, errors: [], messageType: 'unknown' };
  }

  detectMessageType(message) {
    if (!message) return null;

    // OOOI events detection
    if (message.text && /^(OUT|OFF|ON|IN)\s+\d{4}/.test(message.text)) {
      return 'oooi_events';
    }

    // CPDLC detection
    if (message.label && ['_d', '5Z', '5Y'].includes(message.label)) {
      return 'fans1a_cpdlc_message';
    }

    // Position reports
    if (message.text && message.text.includes('POS')) {
      return 'fans1a_adsc_contract';
    }

    return null;
  }

  getSchemaInfo(schemaName) {
    return this.schemas.get(schemaName);
  }

  listSchemas() {
    return Array.from(this.schemas.keys());
  }
}

module.exports = SchemaValidator;

