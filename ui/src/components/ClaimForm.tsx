import { useState, useRef } from 'react';
import { createClaim, type CreateClaimPayload } from '../api';
import { DEMO_CLAIM, fetchDemoImages } from '../lib/demoData';

type ClaimFormProps = {
  onSuccess: (claimId: string) => void;
};

async function presignAndUpload(claimId: string, file: File) {
  const res = await fetch(`/api/claims/${claimId}/damage-photos/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, content_type: file.type }),
  });
  if (!res.ok) throw new Error("Presign failed");
  const { upload_url } = await res.json();
  await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
}

export function ClaimForm({ onSuccess }: ClaimFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [seeding, setSeeding] = useState(false);

  const [form, setForm] = useState<CreateClaimPayload>({
    policy_id: '',
    claimant: { full_name: '', phone: '', email: '', address: '' },
    loss: { date_of_loss: new Date().toISOString().slice(0, 10), city: '', description: '' },
    vehicle: { vin: '', year: undefined, make: '', model: '' },
  });

  const handleChange = (
    section: keyof CreateClaimPayload | 'policy_id',
    field: string,
    value: string | number | undefined
  ) => {
    setForm((prev) => {
      const next = { ...prev };
      if (section === 'claimant' || section === 'loss' || section === 'vehicle') {
        (next[section] as Record<string, unknown>)[field] = value;
      } else {
        (next as Record<string, unknown>)[field] = value;
      }
      return next;
    });
  };

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImages((prev) => [...prev, ...files]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      setForm({ ...DEMO_CLAIM });
      const demoFiles = await fetchDemoImages();
      if (demoFiles.length > 0) setImages(demoFiles);
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: CreateClaimPayload = {
      policy_id: form.policy_id || 'POL-UNKNOWN',
      claimant: {
        full_name: form.claimant.full_name,
        phone: form.claimant.phone,
        email: form.claimant.email || undefined,
        address: form.claimant.address || undefined,
      },
      loss: {
        date_of_loss: form.loss.date_of_loss,
        city: form.loss.city || undefined,
        description: form.loss.description,
      },
      vehicle: {
        vin: form.vehicle.vin || undefined,
        year: form.vehicle.year ? Number(form.vehicle.year) : undefined,
        make: form.vehicle.make || undefined,
        model: form.vehicle.model || undefined,
      },
    };

    try {
      const res = await createClaim(payload);
      if (images.length > 0) {
        for (const img of images) {
          await presignAndUpload(res.claim_id, img);
        }
      }
      onSuccess(res.claim_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="claim-form-wrapper">
      <div className="claim-form-header">
        <h1>Ohio Auto Claims</h1>
        <p className="claim-form-subtitle">First Notice of Loss (FNOL)</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleSeedDemo}
          disabled={seeding || submitting}
          style={{ marginTop: "0.5rem" }}
        >
          {seeding ? "Loading demo data..." : "Seed Demo Data"}
        </button>
      </div>

      <form className="claim-form" onSubmit={handleSubmit}>
        {error && (
          <div className="claim-form-error" role="alert">
            {error}
          </div>
        )}

        <section className="claim-form-section">
          <h2>Policy</h2>
          <div className="form-group">
            <label htmlFor="policy_id">Policy ID</label>
            <input
              id="policy_id"
              type="text"
              value={form.policy_id}
              onChange={(e) => handleChange('policy_id', 'policy_id', e.target.value)}
              placeholder="e.g. POL-12345"
            />
          </div>
        </section>

        <section className="claim-form-section">
          <h2>Claimant</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="full_name">Full Name *</label>
              <input id="full_name" type="text" required value={form.claimant.full_name}
                onChange={(e) => handleChange('claimant', 'full_name', e.target.value)} placeholder="John Smith" />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone *</label>
              <input id="phone" type="tel" required value={form.claimant.phone}
                onChange={(e) => handleChange('claimant', 'phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.claimant.email || ''}
                onChange={(e) => handleChange('claimant', 'email', e.target.value || undefined)} placeholder="john@example.com" />
            </div>
            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input id="address" type="text" value={form.claimant.address || ''}
                onChange={(e) => handleChange('claimant', 'address', e.target.value || undefined)} placeholder="123 Main St, Columbus OH" />
            </div>
          </div>
        </section>

        <section className="claim-form-section">
          <h2>Loss</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date_of_loss">Date of Loss *</label>
              <input id="date_of_loss" type="date" required value={form.loss.date_of_loss}
                onChange={(e) => handleChange('loss', 'date_of_loss', e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="city">City</label>
              <input id="city" type="text" value={form.loss.city || ''}
                onChange={(e) => handleChange('loss', 'city', e.target.value || undefined)} placeholder="Columbus" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea id="description" rows={4} value={form.loss.description}
              onChange={(e) => handleChange('loss', 'description', e.target.value)} placeholder="Describe what happened..." />
          </div>
        </section>

        <section className="claim-form-section">
          <h2>Vehicle</h2>
          <div className="form-group">
            <label htmlFor="vin">VIN</label>
            <input id="vin" type="text" value={form.vehicle.vin || ''}
              onChange={(e) => handleChange('vehicle', 'vin', e.target.value || undefined)} placeholder="1HGBH41JXMN109186" />
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label htmlFor="year">Year</label>
              <input id="year" type="number" min={1900} max={2030} value={form.vehicle.year ?? ''}
                onChange={(e) => handleChange('vehicle', 'year', e.target.value ? Number(e.target.value) : undefined)} placeholder="2020" />
            </div>
            <div className="form-group">
              <label htmlFor="make">Make</label>
              <input id="make" type="text" value={form.vehicle.make || ''}
                onChange={(e) => handleChange('vehicle', 'make', e.target.value || undefined)} placeholder="Honda" />
            </div>
            <div className="form-group">
              <label htmlFor="model">Model</label>
              <input id="model" type="text" value={form.vehicle.model || ''}
                onChange={(e) => handleChange('vehicle', 'model', e.target.value || undefined)} placeholder="Civic" />
            </div>
          </div>
        </section>

        <section className="claim-form-section">
          <h2>Damage Photos</h2>
          <p className="muted" style={{ marginBottom: "0.75rem" }}>Attach photos of vehicle damage (optional). Accepted: JPEG, PNG, WebP.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageAdd}
            style={{ display: "none" }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            + Add Photos
          </button>
          {images.length > 0 && (
            <div className="image-preview-grid">
              {images.map((img, i) => (
                <div key={i} className="image-preview-item">
                  <img src={URL.createObjectURL(img)} alt={img.name} className="image-preview-thumb" />
                  <div className="image-preview-info">
                    <span>{img.name}</span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeImage(i)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="claim-form-actions">
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? (images.length > 0 ? 'Submitting & Uploading...' : 'Submitting...') : `Submit FNOL${images.length > 0 ? ` (+ ${images.length} photo${images.length > 1 ? 's' : ''})` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}
