import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getRun, retryDistribution } from '../api';
import { motion } from 'framer-motion';
import { ProgressBar, InlineBadge } from '../components/ProgressBar';
import Spinner from '../components/Spinner';

function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [live, setLive] = useState<{ status: string; progress: number; step: string; error: string | null; counts: any; links: any } | null>(null);

  const { data: run, isLoading, error } = useQuery({
    queryKey: ['run', id],
    queryFn: () => getRun(id!),
    enabled: !!id,
    refetchInterval: 0,
  });

  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/runs/${id}/stream`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        setLive(data);
        qc.setQueryData(['run', id], (old: any) => (old ? { ...old, status: data.status, progress: data.progress, links: data.links, error: data.error, counts: data.counts, meta: data.meta } : old));
        if (data.status === 'DONE' || data.status === 'FAILED') es.close();
      } catch {}
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [id, qc]);

  const stepLabel = useMemo(() => {
    const s = live?.step || (run ? (run.status === 'FAILED' ? 'failed' : run.status === 'DONE' ? 'done' : 'queued') : 'queued');
    const map: Record<string, string> = {
      queued: "En file d'attente",
      search: 'Recherche',
      ingest: 'Ingestion',
      summarize: 'Résumé',
      generate: 'Génération (présentation)',
      distribute: 'Distribution',
      done: 'Terminé',
      failed: 'Échec',
    };
    return map[s] || s;
  }, [live?.step, run]);

  if (isLoading) return (
    <div className="space-y-4">
      <Spinner />
      <div className="text-gray-600">Chargement des détails…</div>
    </div>
  );
  if (error) return <div>Error fetching run</div>;
  if (!run) return <div>Run not found</div>;

  const effective = (run as any).meta?.gammaOptionsEffective || null;
  const requested = (run as any).meta?.gammaOptionsRequested || null;
  const models = (run as any).meta?.models || null;

  const r = requested || {};
  const e = effective || {};
  function val(v: any) {
    if (v === undefined || v === null) return '—';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  return (
    <div>
      <motion.h1 initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.25}} className="text-3xl font-bold mb-6">Run Details</motion.h1>
      <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.25}} className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {run.keywords.join(', ')}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {new Date(run.createdAt).toLocaleString()}
          </p>
          <div className="mt-4">
            <ProgressBar value={live?.progress ?? run.progress} />
            <div className="text-xs text-gray-500 mt-1">{live?.step ? `Étape: ${stepLabel}` : `${run.progress}%`}</div>
            <div className="mt-3">
              <button
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none"
                onClick={async () => {
                  if (!id) return;
                  try {
                    await retryDistribution(id);
                    alert('Distribution re-queued.');
                  } catch (e) {
                    alert('Failed to queue distribution');
                  }
                }}
              >
                Relancer la distribution
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            { (effective || models) && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Configuration</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {models?.openaiModel && (
                    <div className="mb-2"><span className="font-medium">OpenAI model:</span> {models.openaiModel}</div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-semibold mb-1">Requested</div>
                      <div className="space-y-1">
                        <div><span className="font-medium">Format:</span> {val(r.format)}</div>
                        <div><span className="font-medium">Text mode:</span> {val(r.textMode)}</div>
                        <div><span className="font-medium">Export as:</span> {val(r.exportAs)}</div>
                        <div><span className="font-medium">Theme ID:</span> {val(r.themeId)}</div>
                        <div><span className="font-medium">Num cards:</span> {val(r.numCards)}</div>
                        <div><span className="font-medium">Card split:</span> {val(r.cardSplit)}</div>
                        <div><span className="font-medium">Text language:</span> {val(r.textOptions?.language)}</div>
                        <div><span className="font-medium">Image model:</span> {val(r.imageOptions?.model)}</div>
                        <div><span className="font-medium">Folder IDs:</span> {val(r.folderIds)}</div>
                        <div><span className="font-medium">Instructions:</span> {val(r.additionalInstructions)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Effective</div>
                      <div className="space-y-1">
                        <div><span className="font-medium">Format:</span> {val(e.format || 'presentation')}</div>
                        <div><span className="font-medium">Text mode:</span> {val(e.textMode || 'preserve')}</div>
                        <div><span className="font-medium">Export as:</span> {val(e.exportAs || 'pdf')}</div>
                        <div><span className="font-medium">Theme ID:</span> {val(e.themeId)}</div>
                        <div><span className="font-medium">Num cards:</span> {val(e.numCards)}</div>
                        <div><span className="font-medium">Card split:</span> {val(e.cardSplit || 'auto')}</div>
                        <div><span className="font-medium">Text language:</span> {val(e.textOptions?.language)}</div>
                        <div><span className="font-medium">Image model:</span> {val(e.imageOptions?.model)}</div>
                        <div><span className="font-medium">Folder IDs:</span> {val(e.folderIds)}</div>
                        <div><span className="font-medium">Instructions:</span> {val(e.additionalInstructions)}</div>
                      </div>
                    </div>
                  </div>
                  {requested && JSON.stringify(requested) !== JSON.stringify(effective) && (
                    <div className="mt-3 text-xs text-gray-500">Note: Effective options include defaults applied over the requested ones.</div>
                  )}
                </dd>
              </div>
            )}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{live?.status || run.status}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Progress</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{live?.progress ?? run.progress}%</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Étape</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{stepLabel}</dd>
            </div>
            {live?.counts && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Comptages</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {Object.entries(live.counts).map(([k, v]) => (
                    <InlineBadge key={k}>{k}: {String(v)}</InlineBadge>
                  ))}
                </dd>
              </div>
            )}
            {(live?.error || (run as any).error) && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Erreur</dt>
                <dd className="mt-1 text-sm text-red-700 sm:mt-0 sm:col-span-2">{live?.error || (run as any).error}</dd>
              </div>
            )}
            {(live?.links || (run as any).links) && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Liens</dt>
                <dd className="mt-1 text-sm text-blue-700 sm:mt-0 sm:col-span-2 space-x-4">
                  {((live?.links || (run as any).links) as any).gammaUrl && (
                    <a className="underline" href={((live?.links || (run as any).links) as any).gammaUrl} target="_blank">Gamma</a>
                  )}
                  {((live?.links || (run as any).links) as any).pdfUrl && (
                    <a className="underline" href={((live?.links || (run as any).links) as any).pdfUrl} target="_blank">PDF</a>
                  )}
                  {((live?.links || (run as any).links) as any).driveLink && (
                    <a className="underline" href={((live?.links || (run as any).links) as any).driveLink} target="_blank">Drive</a>
                  )}
                </dd>
              </div>
            )}
            {Array.isArray((run as any).emailLogs) && (run as any).emailLogs.length > 0 && (
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {(() => {
                    const logs = (run as any).emailLogs as any[];
                    const last = logs[logs.length - 1];
                    return (
                      <div>
                        <div><span className="font-medium">Status:</span> {last.status}{last.error ? ` — ${last.error}` : ''}</div>
                        <div><span className="font-medium">To:</span> {Array.isArray(last.to) ? last.to.join(', ') : ''}</div>
                        {last.messageId && (<div><span className="font-medium">Message ID:</span> {last.messageId}</div>)}
                      </div>
                    );
                  })()}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </motion.div>
    </div>
  );
}

export default RunDetail;
