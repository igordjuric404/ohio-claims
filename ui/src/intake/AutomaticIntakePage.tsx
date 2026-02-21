import { useState, useCallback } from "react";
import {
  createIntakeJob,
  presignIntakeFile,
  startExtraction,
  getIntakeJob,
  confirmIntake,
} from "./intakeApi";
import "./intake.css";

type Step = "upload" | "extracting" | "review" | "done";

type ExtractedFields = {
  policy_id?: string;
  claimant?: { full_name?: string; phone?: string; email?: string; address?: string };
  loss?: { date_of_loss?: string; city?: string; description?: string };
  vehicle?: { vin?: string; year?: number; make?: string; model?: string };
};

export function AutomaticIntakePage({ onClaimCreated }: { onClaimCreated: (id: string) => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<ExtractedFields>({});
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleUploadAndExtract = useCallback(async () => {
    if (files.length === 0) return;
    setError("");
    setUploading(true);

    try {
      const { intake_job_id } = await createIntakeJob();
      setJobId(intake_job_id);

      for (const file of files) {
        const { upload_url } = await presignIntakeFile(intake_job_id, file.name, file.type);
        await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      }

      await startExtraction(intake_job_id);
      setStep("extracting");

      let attempts = 0;
      const poll = async (): Promise<void> => {
        const job = await getIntakeJob(intake_job_id);
        if (job.status === "SUCCEEDED") {
          setFields(job.extracted_fields ?? {});
          setConfidence(job.field_confidence ?? {});
          setStep("review");
        } else if (job.status === "FAILED") {
          setError(job.error ?? "Extraction failed");
          setStep("upload");
        } else if (attempts < 60) {
          attempts++;
          await new Promise((r) => setTimeout(r, 2000));
          return poll();
        } else {
          setError("Extraction timed out");
          setStep("upload");
        }
      };
      await poll();
    } catch (err: any) {
      setError(err.message);
      setStep("upload");
    } finally {
      setUploading(false);
    }
  }, [files]);

  const handleConfirm = async () => {
    if (!jobId) return;
    setError("");
    try {
      const result = await confirmIntake(jobId, fields);
      setStep("done");
      onClaimCreated(result.claim_id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateField = (path: string, value: unknown) => {
    const keys = path.split(".");
    setFields((prev) => {
      const next = structuredClone(prev) as any;
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const renderConfidenceBadge = (path: string) => {
    const c = confidence[path];
    if (c === undefined) return null;
    const cls = c >= 0.8 ? "conf-high" : c >= 0.5 ? "conf-med" : "conf-low";
    return <span className={`conf-badge ${cls}`}>{Math.round(c * 100)}%</span>;
  };

  return (
    <div className="intake-page">
      <h1>Automatic Intake</h1>
      {error && <div className="pipeline-error">{error}</div>}

      {step === "upload" && (
        <div className="card intake-upload">
          <h2>Upload Documents</h2>
          <p className="muted">Upload PDFs, images, or text documents for automated field extraction.</p>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={handleFiles} />
          {files.length > 0 && (
            <ul className="intake-file-list">
              {files.map((f, i) => (
                <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
              ))}
            </ul>
          )}
          <button className="btn btn-primary" onClick={handleUploadAndExtract} disabled={files.length === 0 || uploading}>
            {uploading ? "Uploading..." : "Upload & Extract"}
          </button>
        </div>
      )}

      {step === "extracting" && (
        <div className="card intake-extracting">
          <div className="loading-spinner" />
          <h2>Extracting Fields...</h2>
          <p className="muted">Analyzing uploaded documents with AI extraction.</p>
        </div>
      )}

      {step === "review" && (
        <div className="intake-review">
          <h2>Review Extracted Fields</h2>
          <p className="muted">Edit fields as needed before creating the claim.</p>

          <div className="intake-fields-grid">
            <div className="card">
              <h3>Policy</h3>
              <label>Policy ID {renderConfidenceBadge("policy_id")}
                <input value={fields.policy_id ?? ""} onChange={(e) => updateField("policy_id", e.target.value)} />
              </label>
            </div>

            <div className="card">
              <h3>Claimant</h3>
              <label>Full Name {renderConfidenceBadge("claimant.full_name")}
                <input value={fields.claimant?.full_name ?? ""} onChange={(e) => updateField("claimant.full_name", e.target.value)} />
              </label>
              <label>Phone {renderConfidenceBadge("claimant.phone")}
                <input value={fields.claimant?.phone ?? ""} onChange={(e) => updateField("claimant.phone", e.target.value)} />
              </label>
              <label>Email {renderConfidenceBadge("claimant.email")}
                <input value={fields.claimant?.email ?? ""} onChange={(e) => updateField("claimant.email", e.target.value)} />
              </label>
            </div>

            <div className="card">
              <h3>Loss</h3>
              <label>Date of Loss {renderConfidenceBadge("loss.date_of_loss")}
                <input type="date" value={fields.loss?.date_of_loss ?? ""} onChange={(e) => updateField("loss.date_of_loss", e.target.value)} />
              </label>
              <label>City {renderConfidenceBadge("loss.city")}
                <input value={fields.loss?.city ?? ""} onChange={(e) => updateField("loss.city", e.target.value)} />
              </label>
              <label>Description {renderConfidenceBadge("loss.description")}
                <textarea value={fields.loss?.description ?? ""} onChange={(e) => updateField("loss.description", e.target.value)} rows={3} />
              </label>
            </div>

            <div className="card">
              <h3>Vehicle</h3>
              <label>Year {renderConfidenceBadge("vehicle.year")}
                <input type="number" value={fields.vehicle?.year ?? ""} onChange={(e) => updateField("vehicle.year", Number(e.target.value) || undefined)} />
              </label>
              <label>Make {renderConfidenceBadge("vehicle.make")}
                <input value={fields.vehicle?.make ?? ""} onChange={(e) => updateField("vehicle.make", e.target.value)} />
              </label>
              <label>Model {renderConfidenceBadge("vehicle.model")}
                <input value={fields.vehicle?.model ?? ""} onChange={(e) => updateField("vehicle.model", e.target.value)} />
              </label>
            </div>
          </div>

          <div className="intake-actions">
            <button className="btn btn-secondary" onClick={() => setStep("upload")}>← Back</button>
            <button className="btn btn-primary" onClick={handleConfirm}>Confirm & Create Claim</button>
          </div>
        </div>
      )}
    </div>
  );
}
