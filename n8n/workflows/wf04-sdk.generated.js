import { workflow, node, trigger, ifElse, splitInBatches, nextBatch, languageModel, outputParser, merge, expr } from '@n8n/workflow-sdk';

const gPT4oMiniModel = languageModel({
  type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  version: 1.3,
  config: {name: "GPT-4o Mini Model", parameters: {model: {__rl: true, mode: "list", value: "gpt-4o-mini"}, builtInTools: {}, options: {temperature: 0.3}}, position: [3616, 688]}
});

const structuredOutput = outputParser({
  type: "@n8n/n8n-nodes-langchain.outputParserStructured",
  version: 1.3,
  config: {name: "Structured Output", parameters: {jsonSchemaExample: "{\"description\":\"A concise 30-word description\",\"suggestedCategories\":[\"Category1\",\"Category2\"]}"}, position: [3744, 688]}
});

const manualStart = trigger({
  type: "n8n-nodes-base.manualTrigger",
  version: 1,
  config: {name: "Manual Start", parameters: {}, position: [240, 368]},
  output: [{}]
});

const workflowInput = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Workflow Input", parameters: {assignments: {assignments: [{id: "1", name: "spaceName", value: expr("{{ $vars.EXO_SPACE_NAME }}"), type: "string"}]}, options: {}}, position: [464, 464]},
  output: [{spaceName: "space"}]
});

const iFSpaceName = ifElse({
  type: "n8n-nodes-base.if",
  version: 2.3,
  config: {name: "IF Space Name", parameters: {conditions: {options: {caseSensitive: true, leftValue: "", typeValidation: "strict"}, conditions: [{id: "s0", leftValue: expr("{{ String($json.spaceName || '').trim() }}"), rightValue: "", operator: {type: "string", operation: "notEmpty"}}], combinator: "and"}, options: {}}, position: [624, 464]},
  output: [{}]
});

const ensureTrackingTable = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {name: "Ensure Tracking Table", parameters: {resource: "table", operation: "create", tableName: "exo_processed_documents", columns: {column: [{name: "documentId"}, {name: "lastProcessedDate", type: "date"}, {name: "description"}, {name: "categories"}, {name: "spaceName"}, {name: "documentName"}, {name: "documentUrl"}, {name: "editorUrl"}]}, options: {createIfNotExists: true}}, position: [912, 464], onError: "continueRegularOutput"},
  output: [{}]
});

const getSpaces = node({
  type: "@n8n/n8n-nodes-langchain.mcpClient",
  version: 1,
  config: {name: "Get Spaces", parameters: {endpointUrl: expr("{{$vars.EXO_MCP_ENDPOINT}}"), authentication: "mcpOAuth2Api", tool: {__rl: true, value: "get_my_spaces", mode: "list", cachedResultName: "get_my_spaces"}, inputMode: "json", jsonInput: {}, options: {timeout: 120000}}, position: [1136, 464]},
  output: [{content: [{text: [{name: "space", space_id: 1}]}]}]
});

const resolveSpace = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Resolve Space", parameters: {assignments: {assignments: [{id: "1", name: "spaceName", value: expr("{{ String($('Workflow Input').item.json.spaceName || '').trim() }}"), type: "string"}, {id: "2", name: "spaceId", value: expr("{{ ($json.content?.[0]?.text || []).find((s) => s.name === String($('Workflow Input').item.json.spaceName || '').trim())?.space_id }}"), type: "number"}]}, options: {}}, position: [1248, 464]},
  output: [{spaceName: "space", spaceId: 1}]
});

const iFSpaceResolved = ifElse({
  type: "n8n-nodes-base.if",
  version: 2.3,
  config: {name: "IF Space Resolved", parameters: {conditions: {options: {caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3}, conditions: [{id: "k0", leftValue: expr("{{ $json.spaceId != null && $json.spaceId !== \"\" && !Number.isNaN(Number($json.spaceId)) }}"), rightValue: true, operator: {type: "boolean", operation: "true", singleValue: true}}], combinator: "and"}, options: {}}, position: [1424, 464]},
  output: [{}]
});

const listDocuments = node({
  type: "@n8n/n8n-nodes-langchain.mcpClient",
  version: 1,
  config: {name: "List Documents", parameters: {endpointUrl: expr("{{$vars.EXO_MCP_ENDPOINT}}"), authentication: "mcpOAuth2Api", tool: {__rl: true, mode: "list", value: "search_documents", cachedResultName: "search_documents"}, inputMode: "json", jsonInput: expr("{{ { \"offset\": 0, \"query\": \" \", \"limit\": 500, \"space_id\": $(\"Resolve Space\").item.json.spaceId } }}"), options: {timeout: 120000}}, position: [1584, 464]},
  output: [{content: [{text: [{document_id: "doc1", updated_date: "2026-04-24", description: ""}]}]}]
});

const splitOutDocuments = node({
  type: "n8n-nodes-base.splitOut",
  version: 1,
  config: {name: "Split Out Documents", parameters: {fieldToSplitOut: "content[0].text", options: {}}, position: [1712, 464]},
  output: [{document_id: "doc1", updated_date: "2026-04-24", description: ""}]
});

const filterHasDocumentId = node({
  type: "n8n-nodes-base.filter",
  version: 2.3,
  config: {name: "Filter - Has document_id", parameters: {conditions: {options: {caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3}, conditions: [{id: "d0", leftValue: expr("{{ String($json.document_id || '') }}"), rightValue: "", operator: {type: "string", operation: "notEmpty"}}], combinator: "and"}, options: {}}, position: [1808, 464]},
  output: [{document_id: "doc1", updated_date: "2026-04-24", description: ""}]
});

const normalizeDocuments = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Normalize Documents", parameters: {assignments: {assignments: [{id: "1", name: "id", value: expr("{{ String($json.document_id) }}"), type: "string"}, {id: "2", name: "updatedDate", value: expr("{{ $json.updated_date }}"), type: "string"}, {id: "3", name: "description", value: expr("{{ $json.description ?? '' }}"), type: "string"}]}, options: {}}, position: [1808, 464]},
  output: [{id: "doc1", updatedDate: "2026-04-24", description: ""}]
});

const getProcessedForDoc = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {name: "Get Processed For Doc", parameters: {operation: "get", dataTableId: {__rl: true, mode: "name", value: "exo_processed_documents"}, returnAll: true}, position: [2032, 464], executeOnce: true, alwaysOutputData: true, onError: "continueRegularOutput"},
  output: [{}]
});

const limitTo5Documents = node({
  type: "n8n-nodes-base.limit",
  version: 1,
  config: {name: "Limit to 5 Documents", parameters: {maxItems: 5}, position: [2480, 464]},
  output: [{}]
});

const processingSummary = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Processing Summary", parameters: {assignments: {assignments: [{id: "1", name: "message", value: "Document enrichment completed successfully", type: "string"}, {id: "2", name: "processedCount", value: expr("{{ $(\"Update Tracking\").all().length }}"), type: "number"}, {id: "3", name: "timestamp", value: expr("{{ $now.toISO() }}"), type: "string"}]}, options: {}}, position: [2928, 304]},
  output: [{}]
});

const readDocumentContent = node({
  type: "@n8n/n8n-nodes-langchain.mcpClient",
  version: 1,
  config: {name: "Read Document Content", parameters: {endpointUrl: expr("{{$vars.EXO_MCP_ENDPOINT}}"), authentication: "mcpOAuth2Api", tool: {__rl: true, mode: "list", value: "get_document_by_id", cachedResultName: "get_document_by_id"}, inputMode: "json", jsonInput: expr("{{ { \"document_id\": $json.id } }}"), options: {timeout: 120000}}, position: [2928, 464]},
  output: [{content: [{text: {name: "doc", document_id: "doc1", url: "/doc"}}]}]
});

const listCategories = node({
  type: "@n8n/n8n-nodes-langchain.mcpClient",
  version: 1,
  config: {name: "List Categories", parameters: {endpointUrl: expr("{{$vars.EXO_MCP_ENDPOINT}}"), authentication: "mcpOAuth2Api", tool: {__rl: true, value: "get_category_tree", mode: "list", cachedResultName: "get_category_tree"}, inputMode: "json", jsonInput: {}, options: {timeout: 120000}}, position: [3152, 464]},
  output: [{content: [{text: {sub_categories: [{name: "Category1", category_id: 1}]}}]}]
});

const prepareAIInput = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Prepare AI Input", parameters: {assignments: {assignments: [{id: "1", name: "documentId", value: expr("{{ $(\"Process Each Document\").item.json.id }}"), type: "string"}, {id: "2", name: "documentName", value: expr("{{ $(\"Read Document Content\").item.json.content?.[0]?.text?.name || \"\" }}"), type: "string"}, {id: "3", name: "content", value: expr("{{ JSON.stringify($(\"Read Document Content\").item.json.content?.[0]?.text || {}) }}"), type: "string"}, {id: "4", name: "availableCategories", value: expr("{{ (() => { const root = $(\"List Categories\").item.json.content?.[0]?.text; const names = []; const walk = (n) => { if (!n) return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n.name) names.push(n.name); if (Array.isArray(n.sub_categories)) walk(n.sub_categories); }; walk(root?.sub_categories || root); return [...new Set(names.filter(Boolean))]; })() }}"), type: "array"}, {id: "5", name: "updatedDate", value: expr("{{ $(\"Process Each Document\").item.json.updatedDate }}"), type: "string"}, {id: "6", name: "spaceName", value: expr("{{ $(\"Resolve Space\").item.json.spaceName }}"), type: "string"}, {id: "7", name: "documentUrl", value: expr("{{ $(\"Read Document Content\").item.json.content?.[0]?.text?.url ? \"http://exo-qaui.meeds.io\" + $(\"Read Document Content\").item.json.content?.[0]?.text?.url : \"\" }}"), type: "string"}, {id: "8", name: "editorUrl", value: expr("{{ (() => { const docId = $(\"Read Document Content\").item.json.content?.[0]?.text?.document_id || \"\"; return docId ? \"http://exo-qaui.meeds.io/portal/dw/oeditor?docId=\" + encodeURIComponent(docId) : \"\"; })() }}"), type: "string"}]}, options: {}}, position: [3376, 464]},
  output: [{documentId: "doc1", documentName: "doc", content: "{}", availableCategories: ["Category1"], updatedDate: "2026-04-24", spaceName: "space", documentUrl: "", editorUrl: ""}]
});

const analyzeDocument = node({
  type: "@n8n/n8n-nodes-langchain.agent",
  version: 3.1,
  config: {name: "Analyze Document", parameters: {promptType: "define", text: expr("Analyze this document and provide:\n1. A concise description in 30 words or less, written in the same language as the document. If the language is uncertain, default to French.\n2. Suggest 2-3 relevant categories from the available list\n\nDocument: {{ $json.documentName }}\nContent: {{ $json.content }}\n\nAvailable categories: {{ $json.availableCategories.join(\", \") }}"), hasOutputParser: true, options: {systemMessage: "You are a document metadata expert. Return the description in the document's language; if language cannot be identified confidently, return French by default. Keep description concise (max 30 words) and suggest categories only from the provided list."}}, position: [3616, 464], subnodes: {model: gPT4oMiniModel, outputParser: structuredOutput}},
  output: [{output: {description: "description", suggestedCategories: ["Category1"]}}]
});

const extractResults = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Extract Results", parameters: {assignments: {assignments: [{id: "1", name: "documentId", value: expr("{{ $(\"Prepare AI Input\").item.json.documentId }}"), type: "string"}, {id: "2", name: "description", value: expr("{{ $json.output.description }}"), type: "string"}, {id: "3", name: "suggestedCategories", value: expr("{{ $json.output.suggestedCategories }}"), type: "array"}, {id: "4", name: "updatedDate", value: expr("{{ $(\"Prepare AI Input\").item.json.updatedDate }}"), type: "string"}, {id: "5", name: "spaceName", value: expr("{{ $(\"Prepare AI Input\").item.json.spaceName }}"), type: "string"}, {id: "6", name: "documentName", value: expr("{{ $(\"Prepare AI Input\").item.json.documentName }}"), type: "string"}, {id: "7", name: "documentUrl", value: expr("{{ $(\"Prepare AI Input\").item.json.documentUrl }}"), type: "string"}, {id: "8", name: "editorUrl", value: expr("{{ $(\"Prepare AI Input\").item.json.editorUrl }}"), type: "string"}]}, options: {}}, position: [3840, 464]},
  output: [{documentId: "doc1", description: "description", suggestedCategories: ["Category1"], updatedDate: "2026-04-24", spaceName: "space", documentName: "doc", documentUrl: "", editorUrl: ""}]
});

const addDescription = node({
  type: "@n8n/n8n-nodes-langchain.mcpClient",
  version: 1,
  config: {name: "Add Description", parameters: {endpointUrl: expr("{{$vars.EXO_MCP_ENDPOINT}}"), authentication: "mcpOAuth2Api", tool: {__rl: true, value: "update_document_description", mode: "list", cachedResultName: "update_document_description"}, inputMode: "json", jsonInput: expr("{{ { \"document_id\": $(\"Extract Results\").item.json.documentId, \"html_description\": $(\"Extract Results\").item.json.description } }}"), options: {timeout: 120000}}, position: [4064, 464]},
  output: [{}]
});

const iFDescriptionMCPOK = ifElse({
  type: "n8n-nodes-base.if",
  version: 2.3,
  config: {name: "IF Description MCP OK", parameters: {conditions: {options: {caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3}, conditions: [{id: "b0", leftValue: expr("{{ !String($json.content?.[0]?.text ?? '').toLowerCase().includes('exception') }}"), rightValue: true, operator: {type: "boolean", operation: "true", singleValue: true}}], combinator: "and"}, options: {}}, position: [4192, 464]},
  output: [{}]
});

const checkDescriptionResult = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {name: "Check Description Result", parameters: {assignments: {assignments: [{id: "1", name: "documentId", value: expr("{{ $('Extract Results').item.json.documentId }}"), type: "string"}, {id: "2", name: "description", value: expr("{{ $('Extract Results').item.json.description }}"), type: "string"}, {id: "3", name: "suggestedCategories", value: expr("{{ $('Extract Results').item.json.suggestedCategories }}"), type: "array"}, {id: "4", name: "updatedDate", value: expr("{{ $('Extract Results').item.json.updatedDate }}"), type: "string"}, {id: "5", name: "spaceName", value: expr("{{ $('Extract Results').item.json.spaceName }}"), type: "string"}, {id: "6", name: "documentName", value: expr("{{ $('Extract Results').item.json.documentName }}"), type: "string"}, {id: "7", name: "documentUrl", value: expr("{{ $('Extract Results').item.json.documentUrl }}"), type: "string"}, {id: "8", name: "editorUrl", value: expr("{{ $('Extract Results').item.json.editorUrl }}"), type: "string"}]}, options: {}}, position: [4432, 464]},
  output: [{documentId: "doc1", description: "description", suggestedCategories: ["Category1"], updatedDate: "2026-04-24", spaceName: "space", documentName: "doc", documentUrl: "", editorUrl: ""}]
});

const prepareCategoryAssignments = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {name: "Prepare Category Assignments", parameters: {jsCode: "const doc = $json;\nconst wanted = (doc.suggestedCategories || []).map((n) => String(n));\nconst tree = $(\"List Categories\").item.json.content?.[0]?.text;\nconst map = new Map();\nconst normalize = (s) => String(s || \"\").replace(/&amp;/g, \"&\").replace(/\\\\s+/g, \" \").trim().toLowerCase();\nconst walk = (node) => {\n  if (!node) return;\n  if (Array.isArray(node)) { node.forEach(walk); return; }\n  if (node.name && node.category_id != null) map.set(normalize(node.name), node.category_id);\n  if (Array.isArray(node.sub_categories)) walk(node.sub_categories);\n};\nwalk(tree?.sub_categories || tree);\nconst out = [];\nfor (const name of wanted) {\n  const id = map.get(normalize(name));\n  if (id != null) out.push({ json: { ...doc, categoryName: name, category_id: id, content_id: doc.documentId, content_type: \"document\" } });\n}\nif (!out.length) throw new Error(\"No category_id match for suggested categories: \" + JSON.stringify(wanted));\nreturn out;"}, position: [4512, 464]},
  output: [{}]
});

const assignCategories = node({
  type: "@n8n/n8n-nodes-langchain.mcpClient",
  version: 1,
  config: {name: "Assign Categories", parameters: {endpointUrl: expr("{{$vars.EXO_MCP_ENDPOINT}}"), authentication: "mcpOAuth2Api", tool: {__rl: true, value: "add_content_to_category", mode: "list", cachedResultName: "add_content_to_category"}, inputMode: "json", jsonInput: expr("{{ { \"category_id\": $json.category_id, \"content_id\": $json.content_id, \"content_type\": $json.content_type } }}"), options: {timeout: 120000}}, position: [4736, 464]},
  output: [{}]
});

const iFAssignMCPOK = ifElse({
  type: "n8n-nodes-base.if",
  version: 2.3,
  config: {name: "IF Assign MCP OK", parameters: {conditions: {options: {caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3}, conditions: [{id: "b0", leftValue: expr("{{ !String($json.content?.[0]?.text ?? '').toLowerCase().includes('exception') }}"), rightValue: true, operator: {type: "boolean", operation: "true", singleValue: true}}], combinator: "and"}, options: {}}, position: [4864, 464]},
  output: [{}]
});

const checkAssignResult = node({
  type: "n8n-nodes-base.noOp",
  version: 1,
  config: {name: "Check Assign Result", parameters: {}, position: [5088, 464]},
  output: [{}]
});

const updateTracking = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {name: "Update Tracking", parameters: {operation: "upsert", dataTableId: {__rl: true, mode: "name", value: "exo_processed_documents"}, filters: {conditions: [{keyName: "documentId", keyValue: expr("{{ $(\"Check Description Result\").item.json.documentId }}")}]}, columns: {mappingMode: "defineBelow", value: {documentId: expr("{{ $(\"Check Description Result\").item.json.documentId }}"), lastProcessedDate: expr("{{ $now.toISO() }}"), description: expr("{{ $(\"Check Description Result\").item.json.description }}"), categories: expr("{{ ($(\"Check Description Result\").item.json.suggestedCategories || []).join(\", \") }}"), spaceName: expr("{{ $(\"Check Description Result\").item.json.spaceName }}"), documentName: expr("{{ $(\"Check Description Result\").item.json.documentName }}"), documentUrl: expr("{{ $(\"Check Description Result\").item.json.documentUrl }}"), editorUrl: expr("{{ $(\"Check Description Result\").item.json.editorUrl }}")}, matchingColumns: [], schema: [{id: "documentId", displayName: "documentId", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}, {id: "lastProcessedDate", displayName: "lastProcessedDate", required: false, defaultMatch: false, display: true, type: "dateTime", readOnly: false, removed: false}, {id: "description", displayName: "description", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}, {id: "categories", displayName: "categories", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}, {id: "spaceName", displayName: "spaceName", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}, {id: "documentName", displayName: "documentName", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}, {id: "documentUrl", displayName: "documentUrl", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}, {id: "editorUrl", displayName: "editorUrl", required: false, defaultMatch: false, display: true, type: "string", readOnly: false, removed: false}], attemptToConvertTypes: false, convertFieldsToString: false}, options: {}}, position: [5184, 592]},
  output: [{}]
});

const processEachDocument = splitInBatches({
  type: "n8n-nodes-base.splitInBatches",
  version: 3,
  config: {name: "Process Each Document", parameters: {options: {}}, position: [2704, 464]},
  output: [{}]
});

const stopCategoryAssignFailed = node({
  type: "n8n-nodes-base.stopAndError",
  version: 1,
  config: {name: "Stop - Category assign failed", parameters: {errorMessage: "MCP add_content_to_category: échec."}, position: [4880, 304]},
  output: [{}]
});

const stopDescriptionUpdateFailed = node({
  type: "n8n-nodes-base.stopAndError",
  version: 1,
  config: {name: "Stop - Description update failed", parameters: {errorMessage: "MCP update_document_description: réponse d’échec."}, position: [4208, 304]},
  output: [{}]
});

const stopSpaceNotFound = node({
  type: "n8n-nodes-base.stopAndError",
  version: 1,
  config: {name: "Stop - Space not found", parameters: {errorMessage: "Espace eXo introuvable (aucun espace de ce nom pour l’utilisateur)."}, position: [1440, 304]},
  output: [{}]
});

const stopMissingSpaceName = node({
  type: "n8n-nodes-base.stopAndError",
  version: 1,
  config: {name: "Stop - Missing spaceName", parameters: {errorMessage: "Missing required workflow input: 'spaceName'"}, position: [640, 288]},
  output: [{}]
});

const dailySchedule = trigger({
  type: "n8n-nodes-base.scheduleTrigger",
  version: 1.3,
  config: {name: "Daily Schedule", parameters: {rule: {interval: [{triggerAtHour: 2}]}}, position: [240, 560]},
  output: [{}]
});

const mergeDocumentsToProcess = merge({
  type: "n8n-nodes-base.merge",
  version: 3.2,
  config: {name: "Merge Documents to Process", parameters: {mode: "combineBySql", numberInputs: 2, query: "SELECT input1.id, input1.updatedDate, input1.description\nFROM input1\nLEFT JOIN input2 ON input1.id = input2.documentId\nWHERE input2.documentId IS NULL\n   OR input2.lastProcessedDate IS NULL\n   OR input2.lastProcessedDate = ''\n   OR input1.updatedDate > input2.lastProcessedDate", options: {emptyQueryResult: "empty"}}, position: [2256, 464]}
});
const assignCheckFlow = iFAssignMCPOK
  .onTrue(checkAssignResult.to(updateTracking.to(nextBatch(processEachDocument))))
  .onFalse(stopCategoryAssignFailed);

const descriptionCheckFlow = iFDescriptionMCPOK
  .onTrue(checkDescriptionResult.to(prepareCategoryAssignments.to(assignCategories.to(assignCheckFlow))))
  .onFalse(stopDescriptionUpdateFailed);

const documentProcessingFlow = readDocumentContent
  .to(listCategories.to(prepareAIInput.to(analyzeDocument.to(extractResults.to(addDescription.to(descriptionCheckFlow))))));

const batchFlow = processEachDocument
  .onDone(processingSummary)
  .onEachBatch(documentProcessingFlow);

const documentsBeforeMergeFlow = listDocuments
  .to(splitOutDocuments.to(filterHasDocumentId.to(normalizeDocuments.to(mergeDocumentsToProcess.input(0)))));

const processedRowsFlow = getProcessedForDoc.to(mergeDocumentsToProcess.input(1));

const resolvedSpaceFlow = iFSpaceResolved
  .onTrue(documentsBeforeMergeFlow)
  .onFalse(stopSpaceNotFound);

const spaceNameFlow = iFSpaceName
  .onTrue(ensureTrackingTable.to(getSpaces.to(resolveSpace.to(resolvedSpaceFlow))))
  .onFalse(stopMissingSpaceName);

const mainFlow = workflowInput.to(spaceNameFlow);

export default workflow('aze2wAktXHYrTBTr', "eXo Document Enrichment with AI")
  .add(manualStart)
  .to(mainFlow)
  .add(normalizeDocuments)
  .to(processedRowsFlow)
  .add(mergeDocumentsToProcess)
  .to(limitTo5Documents.to(batchFlow))
  .add(dailySchedule)
  .to(workflowInput);
