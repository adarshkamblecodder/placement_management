function htmlEscape(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function makeField({
  name,
  label,
  value,
  type = "text",
  helpText,
  errors = [],
  disabled = false,
  accept,
} = {}) {
  const id_for_label = `id_${name}`;
  let html = "";

  const disabledAttr = disabled ? "disabled" : "";
  if (type === "textarea") {
    html = `<textarea class="form-control mb-3" name="${name}" id="${id_for_label}" ${disabledAttr}>${htmlEscape(
      value
    )}</textarea>`;
  } else if (type === "file") {
    const acceptAttr = accept ? `accept="${accept}"` : "";
    html = `<input class="form-control mb-3" type="file" name="${name}" id="${id_for_label}" ${acceptAttr} ${disabledAttr} />`;
  } else if (type === "number") {
    html = `<input class="form-control mb-3" type="number" step="0.01" name="${name}" id="${id_for_label}" value="${htmlEscape(
      value
    )}" ${disabledAttr} />`;
  } else if (type === "email") {
    html = `<input class="form-control mb-3" type="email" name="${name}" id="${id_for_label}" value="${htmlEscape(
      value
    )}" ${disabledAttr} />`;
  } else {
    html = `<input class="form-control mb-3" type="${type}" name="${name}" id="${id_for_label}" value="${htmlEscape(
      value
    )}" ${disabledAttr} />`;
  }

  const field = {
    name,
    label,
    id_for_label,
    help_text: helpText || "",
    errors,
    html,
    toString() {
      return this.html;
    },
  };

  return field;
}

function buildField(name, label, type, value, choices_or_options, extra_options = {}) {
  const id_for_label = `id_${name}`;
  let html = '';
  const requiredAttr = extra_options.required ? 'required' : '';
  
  if (type === 'select') {
    html = `<select class="form-select mb-3" name="${name}" id="${id_for_label}" ${requiredAttr}>`;
    if (Array.isArray(choices_or_options)) {
      choices_or_options.forEach(([val, text]) => {
        const selected = String(val) === String(value) ? 'selected' : '';
        html += `<option value="${htmlEscape(val)}" ${selected}>${htmlEscape(text)}</option>`;
      });
    }
    html += `</select>`;
  } else {
    const stepAttr = extra_options.step ? `step="${extra_options.step}"` : '';
    html = `<input class="form-control mb-3" type="${type}" name="${name}" id="${id_for_label}" value="${htmlEscape(value)}" ${requiredAttr} ${stepAttr}/>`;
  }
  
  return { name, label, id_for_label, html };
}

module.exports = { makeField, buildField };
