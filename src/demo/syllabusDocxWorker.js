self.onmessage = async (event) => {
  try {
    const imported = await import("mammoth");
    const mammoth = imported.default || imported;
    const result = await mammoth.extractRawText({ arrayBuffer: event.data.arrayBuffer });
    self.postMessage({
      type: "complete",
      value: result.value,
      messages: (result.messages || []).map((message) => ({ type: message.type, message: message.message })),
    });
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || "The Word document could not be read." });
  }
};
