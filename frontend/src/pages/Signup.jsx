import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import Wordmark from "../components/Wordmark";
import { Check, Loader2, Camera, ArrowLeft } from "lucide-react";
import { track, Events } from "../lib/analytics";
import PostSignupInvite from "./PostSignupInvite";

export default function Signup() {
  const nav = useNavigate();
  const { code: urlCode } = useParams();
  const { register, setUser } = useAuth();
  const [step, setStep] = useState(1);
  const [code, setCode] = useState((urlCode || "").toUpperCase());
  const [codeStatus, setCodeStatus] = useState(null);
  const [validating, setValidating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [photoPath, setPhotoPath] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [bio, setBio] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { track(Events.SIGNUP_STARTED); }, []);
  // If the user landed via /invite/:code, validate it once on mount.
  useEffect(() => {
    if (urlCode && !codeStatus) { validate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = async () => {
    if (!code) return;
    setValidating(true); setErr("");
    try {
      const { data } = await api.post("/auth/validate-invite", { code });
      setCodeStatus(data);
      if (!data.valid) setErr(data.message);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setValidating(false); }
  };

  const goStep2 = async () => {
    // Code is optional now — proceed regardless. If user typed one, validate first.
    if (code && !codeStatus) {
      await validate();
      return;
    }
    if (code && codeStatus && !codeStatus.valid) {
      // user must clear it or fix it
      return;
    }
    setStep(2);
  };

  const createAccount = async (e) => {
    e?.preventDefault();
    setErr(""); setBusy(true);
    try {
      const payload = { name, email: email.trim(), password: pw };
      const inviteUsed = !!(code && codeStatus?.valid);
      if (inviteUsed) payload.invite_code = code;
      await register(payload);
      track(Events.SIGNUP_COMPLETED, { invite_code_used: inviteUsed });
      setStep(3);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoPath(data.url);
      setPhotoPreview(URL.createObjectURL(file));
    } catch { setErr("Couldn't upload that photo."); }
  };

  const finishSetup = async (skip = false) => {
    setBusy(true); setErr("");
    try {
      if (!skip) {
        const updates = {};
        if (photoPath) updates.profile_photo_url = photoPath;
        if (bio) updates.bio = bio;
        if (Object.keys(updates).length > 0) {
          const { data } = await api.patch("/users/me", updates);
          setUser(data);
        }
      }
      setStep(4);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  // Step 4 (post-signup invite) takes over the entire screen — no progress header.
  // This is the last step before /explore. The notification prompt is now triggered
  // on first Feed visit (NotificationsBanner), not here.
  if (step === 4) {
    return <PostSignupInvite onDone={() => nav("/explore", { replace: true })} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{ background: "#1C1C1E", color: "#fff", padding: "44px 24px 30px", textAlign: "center" }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Wordmark size={34} color="#fff" />
        </div>
        <h1 className="t-title1 mt-3" style={{ color: "#fff" }}>Join your friends on Freccos</h1>
        <p className="t-cap" style={{ color: "#8E8E93" }}>Step {step} of 3</p>
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              width: 28, height: 4, borderRadius: 2,
              background: i <= step ? "#0A84FF" : "rgba(255,255,255,0.15)",
              transition: "background 200ms ease-out",
            }} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div style={{ padding: "28px 16px", flex: 1 }} className="fade-in">
          <h2 className="t-title2 mb-1">Got an invite from a friend?</h2>
          <p className="t-sub muted mb-4">
            Drop in their code to auto-follow each other — or skip and join solo.
          </p>
          <input
            data-testid="signup-invite"
            className="ios-input"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeStatus(null); setErr(""); }}
            onBlur={() => code && validate()}
            placeholder="FRIEND'S CODE (optional)"
            maxLength={12}
            style={{ letterSpacing: 2, textAlign: "center", fontWeight: 600 }}
          />
          {codeStatus?.valid && (
            <p className="t-sub mt-2" style={{ color: "#30D158" }} data-testid="signup-invite-ok">
              <Check size={14} style={{ display: "inline", marginRight: 4 }} />
              Invited by {codeStatus.referrer_name} — you&apos;ll auto-follow each other.
            </p>
          )}
          {err && <p data-testid="signup-error" className="t-sub mt-2" style={{ color: "#FF453A" }}>{err}</p>}
          <button
            data-testid="signup-step1-continue"
            className="btn-pill btn-primary w-full mt-5"
            onClick={goStep2}
            disabled={validating}
          >
            {validating ? <Loader2 size={18} className="animate-spin" /> : null}
            {code ? "Continue" : "Skip & continue"}
          </button>
          <p className="t-sub muted text-center mt-4">
            Have an account?{" "}
            <Link to="/login" style={{ color: "#0A84FF" }}>Sign in</Link>
          </p>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={createAccount} style={{ padding: "28px 16px", flex: 1 }} className="fade-in">
          <button type="button" onClick={() => setStep(1)}
            style={{ background: "transparent", border: "none", color: "#0A84FF" }}>
            <ArrowLeft size={18} style={{ verticalAlign: "middle" }} /> Back
          </button>
          <h2 className="t-title2 mt-3 mb-3">Create your account</h2>
          <label className="t-label muted block mb-1">Name</label>
          <input
            data-testid="signup-name"
            className="ios-input mb-3"
            value={name} onChange={(e) => setName(e.target.value)}
            required placeholder="Your name"
          />
          <label className="t-label muted block mb-1">Email</label>
          <input
            data-testid="signup-email"
            className="ios-input mb-3"
            type="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <label className="t-label muted block mb-1">Password</label>
          <input
            data-testid="signup-password"
            className="ios-input"
            type="password" required minLength={6}
            value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="At least 6 characters"
          />
          {err && <p data-testid="signup-error" className="t-sub mt-2" style={{ color: "#FF453A" }}>{err}</p>}
          <button
            data-testid="signup-step2-continue"
            className="btn-pill btn-primary w-full mt-5"
            disabled={busy}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            Create account
          </button>
          <p
            className="t-cap muted text-center"
            style={{ marginTop: 14, lineHeight: 1.5 }}
            data-testid="signup-legal"
          >
            By signing up you agree to our{" "}
            <Link to="/terms" style={{ color: "#0A84FF", textDecoration: "none" }} data-testid="signup-terms-link">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" style={{ color: "#0A84FF", textDecoration: "none" }} data-testid="signup-privacy-link">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      )}

      {step === 3 && (
        <div style={{ padding: "28px 16px", flex: 1 }} className="fade-in">
          <h2 className="t-title2 mb-1">Make it yours</h2>
          <p className="t-sub muted mb-4">A photo and a quick bio help friends recognise you.</p>

          <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }}
            onChange={(e) => handlePhoto(e.target.files?.[0])} />
          <div className="flex items-center gap-3 mb-4">
            <div
              onClick={() => fileRef.current?.click()}
              data-testid="signup-photo-trigger"
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: photoPreview ? `url('${photoPreview}') center/cover` : "rgba(120,120,128,0.16)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#8E8E93",
              }}
            >
              {!photoPreview && <Camera size={24} />}
            </div>
            <div>
              <div className="t-title3">Profile photo</div>
              <div className="t-cap muted">Optional — you can do this later.</div>
            </div>
          </div>

          <label className="t-label muted block mb-1">Bio</label>
          <textarea
            data-testid="signup-bio"
            rows={3}
            className="ios-input"
            value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="One line about you..."
            style={{ resize: "vertical" }}
          />
          {err && <p data-testid="signup-error" className="t-sub mt-2" style={{ color: "#FF453A" }}>{err}</p>}
          <div className="flex gap-2 mt-5">
            <button
              data-testid="signup-skip"
              className="btn-pill btn-secondary flex-1"
              onClick={() => finishSetup(true)} disabled={busy}
            >
              Skip for now
            </button>
            <button
              data-testid="signup-finish"
              className="btn-pill btn-primary flex-1"
              onClick={() => finishSetup(false)} disabled={busy}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
