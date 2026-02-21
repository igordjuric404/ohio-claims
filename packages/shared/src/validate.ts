import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

export function compileSchema<T>(schema: object) {
  const validate = ajv.compile<T>(schema);
  return (data: unknown): { ok: true; data: T } | { ok: false; errors: unknown } => {
    const valid = validate(data);
    if (!valid) return { ok: false, errors: validate.errors };
    return { ok: true, data: data as T };
  };
}

export { ajv };
