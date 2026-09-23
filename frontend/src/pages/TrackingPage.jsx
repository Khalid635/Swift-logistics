import React, { useState } from 'react';
import API from '../api/axios';

const STEPS = ['Pending', 'Processing', 'In Transit', 'Delivered'];

const STEP_TEXT = {
  Pending: 'Parcel booked',
  Processing: 'Being prepared for dispatch',
  'In Transit': 'On the way to the destination',
  Delivered: 'Handed over to the receiver',
};

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TrackingPage({ onBack }) {
  const [trackingId, setTrackingId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = trackingId.trim().toUpperCase();

    setResult(null);
    if (!id) {
      setError('Enter a tracking ID');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const res = await API.get(`/api/track/${encodeURIComponent(id)}`);
      setResult(res.data);
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. It may be waking up, please try again in a minute.');
      } else if (err.response.status === 404) {
        setError('No parcel found with this tracking ID. Check it and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const currentIndex = result ? STEPS.indexOf(result.status) : -1;

  return (
    <div className="box-border flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 to-blue-500 p-4">
      <div className="box-border w-full max-w-md rounded-2xl bg-slate-800 p-8 text-white shadow-2xl">
        <h1 className="m-0 text-2xl font-bold">Track your parcel</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">
          Enter the tracking ID you received when the parcel was booked.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="tracking-id" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tracking ID
          </label>
          <input
            id="tracking-id"
            type="text"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="TRK-ABC123"
            autoComplete="off"
            className="box-border mb-4 w-full rounded-lg border border-solid border-slate-600 bg-slate-900 px-4 py-3 text-base uppercase text-white outline-none placeholder:normal-case placeholder:text-slate-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full cursor-pointer rounded-lg border-0 bg-blue-500 px-4 py-3 text-base font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Searching...' : 'Track parcel'}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-solid border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <div className="mb-5 rounded-xl bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-blue-300">{result.tracking_id}</span>
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
                  {result.status}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Destination: <span className="font-semibold text-white">{result.sub_district}, {result.district}</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Booked on {formatDate(result.created_at)} · Updated {formatDate(result.updated_at)}
              </div>
            </div>

            <ol className="m-0 list-none p-0">
              {STEPS.map((step, i) => {
                const isDelivered = step === 'Delivered' && i === currentIndex;
                const done = i < currentIndex || isDelivered;
                const current = i === currentIndex && !isDelivered;
                const isLast = i === STEPS.length - 1;

                let circleClass = 'bg-slate-600 text-slate-300';
                if (done) circleClass = 'bg-emerald-500 text-white';
                if (current) circleClass = 'bg-blue-500 text-white ring-4 ring-blue-500/30';

                return (
                  <li key={step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${circleClass}`}>
                        {done ? '✓' : i + 1}
                      </span>
                      {!isLast && (
                        <span className={`h-8 w-0.5 ${i < currentIndex ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className={`text-sm font-semibold ${done || current ? 'text-white' : 'text-slate-500'}`}>
                        {step}
                        {current && <span className="ml-2 text-xs font-normal text-blue-300">Current status</span>}
                      </div>
                      <div className={`text-xs ${done || current ? 'text-slate-400' : 'text-slate-600'}`}>
                        {STEP_TEXT[step]}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 block w-full cursor-pointer border-0 bg-transparent p-0 text-center text-sm font-semibold text-blue-400 hover:underline"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
