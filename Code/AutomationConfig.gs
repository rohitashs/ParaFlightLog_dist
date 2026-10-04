/**
 * Paragliding Flight Log v2.0
 * Updated: 2026-10-04 09:43:52
 * 
 * MODULE: Automation Configuration & Registry
 * 
 * Contains:
 * 1. AUTOMATION_REGISTRY: Declarative definition of Triggers, Events, Actions, and Rule Templates.
 * 2. Parameter Schemas: Rich metadata defining types, inputs, bounds, and defaults for each action.
 * 3. Progressive Feature Flags: actionAvailable boolean gating production-ready vs. candidate actions.
 * 
 * @design Docs/Design/DSGN-AUT-001_Table_Driven_Automation_Engine.md
 * @architecture Docs/Architecture/Views/02_Execution_and_Runtime.md
 * @pattern Docs/Patterns_and_Practices.md#pattern-21-subsystem-domain-decoupling-domain-configuration-vs-domain-engine
 * @pattern Docs/Patterns_and_Practices.md#pattern-23-progressive-feature-flagging-in-component-registries-actionavailable
 */

/* ==========================================================================================
   AUTOMATION REGISTRY (Declarative Metadata & Schema)
   ========================================================================================== */

var AUTOMATION_REGISTRY = {
  // ----------------------------------------------------------------------------------------
  // 1. TRIGGER TYPES
  // ----------------------------------------------------------------------------------------
  triggers: {
    'TIME_MINS': {
      id: 'TIME_MINS',
      label: 'Time (Minutes)',
      unit: 'minutes',
      validation: { min: 5, max: 1440, default: 15 },
      tooltip: 'Runs every X minutes via the Master Heartbeat dispatcher (minimum 5 minutes).'
    },
    'TIME_DAYS': {
      id: 'TIME_DAYS',
      label: 'Time (Days)',
      unit: 'days',
      validation: { min: 1, max: 365, default: 3 },
      tooltip: 'Runs every X days during off-peak windows.'
    },
    'EVENT': {
      id: 'EVENT',
      label: 'Event (Lifecycle)',
      eventSource: 'REGISTRY_EVENTS',
      tooltip: 'Executes automatically when a specific system lifecycle event completes.'
    },
    'MANUAL': {
      id: 'MANUAL',
      label: 'Manual Execution Only',
      tooltip: 'Executes only when manually triggered by the pilot via menu or dialog.'
    }
  },

  // ----------------------------------------------------------------------------------------
  // 2. LIFECYCLE EVENTS
  // ----------------------------------------------------------------------------------------
  events: {
    'INGESTION_COMPLETED': {
      id: 'INGESTION_COMPLETED',
      label: 'Flight Ingestion Finished',
      emittedBy: 'Code/Ingestion.gs',
      payloadSchema: { batchId: 'string', count: 'number', flightIds: 'array' },
      description: 'Triggered whenever flights are imported via Bulk Ingestion, Watch Folder, or URL.'
    },
    'FLIGHT_PURGED': {
      id: 'FLIGHT_PURGED',
      label: 'Flights Purged to Trash',
      emittedBy: 'Code/Code.gs:purgeRemoveFlights',
      payloadSchema: { count: 'number', fileIds: 'array' },
      description: 'Triggered whenever flights marked Remove are purged to Trash.'
    },
    'CONFIG_RESTORED': {
      id: 'CONFIG_RESTORED',
      label: 'Configuration Restored from JSON',
      emittedBy: 'Code/Code.gs:importConfigJson_',
      payloadSchema: { sections: 'array' },
      description: 'Triggered whenever configuration sections are imported from JSON.'
    }
  },

  // ----------------------------------------------------------------------------------------
  // 3. ACTIONS REGISTRY
  // ----------------------------------------------------------------------------------------
  actions: {
    // --------------------------------------------------------------------------------------
    // PRODUCTION-READY ACTIONS (actionAvailable: true)
    // --------------------------------------------------------------------------------------
    'SCAN_WATCH_FOLDER': {
      id: 'SCAN_WATCH_FOLDER',
      actionAvailable: true,
      label: 'Scan Watch Folder',
      category: 'Ingestion',
      description: 'Scans configured Google Drive watch folders for new flight logs, copies to Master Folder, and moves source files to Trash.',
      allowedTriggers: ['TIME_MINS', 'MANUAL'],
      defaultTrigger: { type: 'TIME_MINS', config: 15 },
      handlerName: 'executeWatchFolderScan_',
      parametersSchema: {
        'MoveToTrash': {
          parameterId: 'MoveToTrash',
          parameterLabel: 'Move to Trash After Success',
          valueType: 'Boolean',
          valueInput: 'Unique',
          valueLabel: 'Flag',
          valueSet: 'Yes, No',
          defaultValue: true,
          description: 'Move source files to Trash folder after successful ingestion.',
          validation: function(v) { return typeof v === 'boolean'; }
        },
        'MaxFiles': {
          parameterId: 'MaxFiles',
          parameterLabel: 'Max Files per Scan',
          valueType: 'Number',
          valueInput: 'Unique',
          valueLabel: 'Files',
          valueSet: '1-100',
          defaultValue: 20,
          description: 'Maximum number of flight files to process in a single scan.',
          validation: function(v) { return !isNaN(v) && v > 0 && v <= 100; }
        }
      }
    },

    'CLEAN_LOGS': {
      id: 'CLEAN_LOGS',
      actionAvailable: true,
      label: 'Clean Activity Logs',
      category: 'Maintenance',
      description: 'Prunes historical activity logs exceeding KeepRows if they are older than KeepDays.',
      allowedTriggers: ['TIME_DAYS', 'MANUAL'],
      defaultTrigger: { type: 'TIME_DAYS', config: 3 },
      handlerName: 'executeCleanLogs_',
      parametersSchema: {
        'KeepRows': {
          parameterId: 'KeepRows',
          parameterLabel: 'Rows to Retain',
          valueType: 'Number',
          valueInput: 'Unique',
          valueLabel: 'Rows',
          valueSet: '0-50000',
          defaultValue: 2000,
          description: 'Minimum number of activity log rows to retain before pruning.',
          validation: function(v) { return !isNaN(v) && v >= 0; }
        },
        'KeepDays': {
          parameterId: 'KeepDays',
          parameterLabel: 'Days to Retain',
          valueType: 'Number',
          valueInput: 'Unique',
          valueLabel: 'Days',
          valueSet: '1-3650',
          defaultValue: 90,
          description: 'Minimum age (in days) of logs to retain before pruning.',
          validation: function(v) { return !isNaN(v) && v > 0; }
        }
      }
    },

    'PROCESS_QUEUE': {
      id: 'PROCESS_QUEUE',
      actionAvailable: true,
      label: 'Process Background Queue',
      category: 'System',
      description: 'Executes pending or checkpointed batch jobs from the Automation_Queue sheet under the 4.5-minute time budget.',
      allowedTriggers: ['TIME_MINS', 'EVENT', 'MANUAL'],
      defaultTrigger: { type: 'TIME_MINS', config: 5 },
      handlerName: 'executeProcessQueue_',
      parametersSchema: {
        'BatchSize': {
          parameterId: 'BatchSize',
          parameterLabel: 'Items per Step',
          valueType: 'Number',
          valueInput: 'Unique',
          valueLabel: 'Items',
          valueSet: '1-20',
          defaultValue: 5,
          description: 'Number of items/files/rows processed per worker batch step.',
          validation: function(v) { return !isNaN(v) && v > 0 && v <= 20; }
        },
        'MaxExecutionSeconds': {
          parameterId: 'MaxExecutionSeconds',
          parameterLabel: 'Time Budget Ceiling',
          valueType: 'Number',
          valueInput: 'Unique',
          valueLabel: 'Seconds',
          valueSet: '30-270',
          defaultValue: 240,
          description: 'Maximum runtime seconds before checkpointing progress.',
          validation: function(v) { return !isNaN(v) && v >= 30 && v <= 270; }
        }
      }
    },

    // --------------------------------------------------------------------------------------
    // CANDIDATE / PLANNED ACTIONS (actionAvailable: false)
    // Gated from UI until parameters and overwrite safeguards are finalized
    // --------------------------------------------------------------------------------------
    'ENRICH_FLIGHT_GEO': {
      id: 'ENRICH_FLIGHT_GEO',
      actionAvailable: false,
      label: 'Enrich Flight Sites & Geo',
      category: 'Enrichment',
      description: 'Backfills takeoff/landing site names and reverse geocoding on flight tracks.',
      allowedTriggers: ['EVENT', 'TIME_DAYS', 'MANUAL'],
      defaultTrigger: { type: 'EVENT', config: 'INGESTION_COMPLETED' },
      handlerName: 'executeEnrichGeo_',
      parametersSchema: {
        'OverwriteSite': {
          parameterId: 'OverwriteSite',
          parameterLabel: 'Overwrite Existing Site',
          valueType: 'Boolean',
          valueInput: 'Unique',
          valueSet: 'Yes, No',
          defaultValue: false
        },
        'OverwriteCountry': {
          parameterId: 'OverwriteCountry',
          parameterLabel: 'Overwrite Existing Country',
          valueType: 'Boolean',
          valueInput: 'Unique',
          valueSet: 'Yes, No',
          defaultValue: false
        },
        'Providers': {
          parameterId: 'Providers',
          parameterLabel: 'Geo Providers',
          valueType: 'Multi',
          valueInput: 'Multi',
          valueSet: 'paragliding_earth, overpass_api, google',
          defaultValue: ['paragliding_earth']
        },
        'BatchLimit': {
          parameterId: 'BatchLimit',
          parameterLabel: 'Max Flights per Batch',
          valueType: 'Number',
          valueInput: 'Unique',
          valueSet: '1-50',
          defaultValue: 20
        }
      }
    },

    'ENRICH_FLIGHT_WEATHER': {
      id: 'ENRICH_FLIGHT_WEATHER',
      actionAvailable: false,
      label: 'Enrich Historical Weather',
      category: 'Enrichment',
      description: 'Backfills historical weather conditions at launch coordinates for unpopulated flights.',
      allowedTriggers: ['EVENT', 'TIME_DAYS', 'MANUAL'],
      defaultTrigger: { type: 'EVENT', config: 'INGESTION_COMPLETED' },
      handlerName: 'executeEnrichWeather_',
      parametersSchema: {
        'OverwriteObservations': {
          parameterId: 'OverwriteObservations',
          parameterLabel: 'Overwrite Existing Observations',
          valueType: 'Boolean',
          valueInput: 'Unique',
          valueSet: 'Yes, No',
          defaultValue: false
        },
        'BatchLimit': {
          parameterId: 'BatchLimit',
          parameterLabel: 'Max Flights per Batch',
          valueType: 'Number',
          valueInput: 'Unique',
          valueSet: '1-50',
          defaultValue: 20
        }
      }
    },

    'PURGE_STAGED_FLIGHTS': {
      id: 'PURGE_STAGED_FLIGHTS',
      actionAvailable: false,
      label: 'Purge Flights Marked Remove',
      category: 'Maintenance',
      description: 'Trashes Master IGC files and permanently deletes flight rows marked Remove.',
      allowedTriggers: ['TIME_DAYS', 'MANUAL'],
      defaultTrigger: { type: 'TIME_DAYS', config: 7 },
      handlerName: 'executePurgeFlights_',
      parametersSchema: {
        'MoveToTrash': {
          parameterId: 'MoveToTrash',
          parameterLabel: 'Move to Google Drive Trash',
          valueType: 'Boolean',
          valueInput: 'Unique',
          valueSet: 'Yes, No',
          defaultValue: true
        }
      }
    }
  },

  // ----------------------------------------------------------------------------------------
  // 4. PREDEFINED RULE TEMPLATES (Prototypes for Automation_Rules sheet rows)
  // ----------------------------------------------------------------------------------------
  templates: [
    {
      id: 'TPL_WATCH_FOLDER',
      active: true,
      name: 'Poll Watch Folders',
      action: 'SCAN_WATCH_FOLDER',
      triggerType: 'Time (Minutes)',
      triggerConfig: 15,
      condition: '',
      parameters: 'MoveToTrash=Yes; MaxFiles=20',
      description: 'Scans Google Drive watch folders every 15 minutes for new IGC flight logs.'
    },
    {
      id: 'TPL_CLEAN_LOGS',
      active: true,
      name: 'Prune Activity Logs',
      action: 'CLEAN_LOGS',
      triggerType: 'Time (Days)',
      triggerConfig: 3,
      condition: '',
      parameters: 'KeepRows=2000; KeepDays=90',
      description: 'Prunes old log entries older than 90 days if the log exceeds 2,000 rows.'
    },
    {
      id: 'TPL_PROCESS_QUEUE',
      active: true,
      name: 'Process Background Queue',
      action: 'PROCESS_QUEUE',
      triggerType: 'Time (Minutes)',
      triggerConfig: 5,
      condition: '',
      parameters: 'BatchSize=5; MaxExecutionSeconds=240',
      description: 'Processes pending background queue jobs (bulk imports, updates, purges).'
    }
  ],

  // ----------------------------------------------------------------------------------------
  // 5. HELPER ACCESSORS
  // ----------------------------------------------------------------------------------------

  /**
   * Returns a map of actions filtered strictly by actionAvailable === true.
   * Used by the Rule Builder UI and in-sheet data validation dropdowns.
   * @return {Object}
   */
  getAvailableActions: function() {
    var available = {};
    for (var key in AUTOMATION_REGISTRY.actions) {
      if (AUTOMATION_REGISTRY.actions[key].actionAvailable === true) {
        available[key] = AUTOMATION_REGISTRY.actions[key];
      }
    }
    return available;
  },

  /**
   * Returns a list of available action keys for in-sheet dropdown validation.
   * @return {Array<string>}
   */
  getAvailableActionKeys: function() {
    var keys = [];
    for (var key in AUTOMATION_REGISTRY.actions) {
      if (AUTOMATION_REGISTRY.actions[key].actionAvailable === true) {
        keys.push(key);
      }
    }
    return keys;
  },

  /**
   * Retrieves an action definition by key.
   * @param {string} actionKey
   * @return {Object|null}
   */
  getAction: function(actionKey) {
    if (!actionKey) return null;
    return AUTOMATION_REGISTRY.actions[String(actionKey).trim()] || null;
  },

  /**
   * Retrieves default parameters as a structured JavaScript object for a given action.
   * @param {string} actionKey
   * @return {Object}
   */
  getDefaultParams: function(actionKey) {
    var action = AUTOMATION_REGISTRY.getAction(actionKey);
    var defaults = {};
    if (action && action.parametersSchema) {
      for (var paramId in action.parametersSchema) {
        defaults[paramId] = action.parametersSchema[paramId].defaultValue;
      }
    }
    return defaults;
  },

  /**
   * Returns all predefined rule templates.
   * @return {Array<Object>}
   */
  getTemplates: function() {
    return AUTOMATION_REGISTRY.templates.slice();
  }
};
