'use client';

import { SectionTitle } from '@/components/SectionTitle';
import { Button, Card } from '@/lib/ui';
import { useEffect, useMemo, useState } from 'react';

type Friendship = {
  id: string;
  status: 'pending' | 'accepted' | 'blocked';
  direction: 'incoming' | 'outgoing';
  friend: { id: string; handle: string; image: string | null } | null;
};

type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
};

export function SocialPanel() {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [handle, setHandle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accepted = friendships.filter((f) => f.status === 'accepted' && f.friend);
  const pendingIn = friendships.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const pendingOut = friendships.filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const selected = useMemo(
    () => accepted.find((f) => f.friend?.id === selectedId)?.friend ?? null,
    [accepted, selectedId],
  );

  async function loadFriends() {
    const res = await fetch('/api/friends');
    const body = (await res.json().catch(() => null)) as { friendships?: Friendship[]; error?: string } | null;
    if (!res.ok) {
      setStatus(body?.error ?? `Failed to load friends (${res.status})`);
      return;
    }
    const next = body?.friendships ?? [];
    setFriendships(next);
    setSelectedId((current) => current ?? next.find((f) => f.status === 'accepted')?.friend?.id ?? null);
  }

  async function loadMessages(friendId: string) {
    const res = await fetch(`/api/messages/${encodeURIComponent(friendId)}`);
    const body = (await res.json().catch(() => null)) as { messages?: Message[]; error?: string } | null;
    if (!res.ok) {
      setStatus(body?.error ?? `Failed to load messages (${res.status})`);
      return;
    }
    setMessages(body?.messages ?? []);
  }

  useEffect(() => {
    void loadFriends();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId]);

  async function addFriend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextHandle = handle.trim();
    if (!nextHandle) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: nextHandle }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setStatus(body?.error ?? `Request failed (${res.status})`);
        return;
      }
      setHandle('');
      await loadFriends();
    } finally {
      setLoading(false);
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    setStatus(null);
    const res = await fetch(`/api/friends/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(body?.error ?? `Update failed (${res.status})`);
      return;
    }
    await loadFriends();
  }

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    setStatus(null);
    const res = await fetch(`/api/messages/${encodeURIComponent(selectedId)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(body?.error ?? `Send failed (${res.status})`);
      setDraft(text);
      return;
    }
    await loadMessages(selectedId);
  }

  return (
    <>
      <SectionTitle
        title="Social"
        subtitle="Add friends by handle and send encrypted direct messages."
      />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <form onSubmit={addFriend} className="space-y-3">
              <label htmlFor="friend-handle" className="block text-sm font-medium text-charcoal">
                Add friend
              </label>
              <div className="flex gap-2">
                <input
                  id="friend-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="friend-handle"
                  className="min-w-0 flex-1 rounded-md border border-charcoal/20 bg-canvas px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-glove"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" variant="primary" disabled={loading || !handle.trim()}>
                  Add
                </Button>
              </div>
              {status ? <p className="text-sm text-red-500">{status}</p> : null}
            </form>
          </Card>

          <Card className="space-y-4">
            <FriendList
              title="Friends"
              empty="No friends yet."
              friendships={accepted}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <RequestList title="Requests" friendships={pendingIn} onRespond={respond} />
            <FriendList title="Sent" empty="No pending sent requests." friendships={pendingOut} />
          </Card>
        </div>

        <Card className="min-h-[520px] flex flex-col">
          {selected ? (
            <>
              <div className="border-b border-charcoal/10 pb-3">
                <h2 className="font-display text-xl tracking-wide text-charcoal">
                  {selected.handle}
                </h2>
                <p className="text-xs text-charcoal-soft">
                  Messages are encrypted before storage and decrypted for this thread.
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-charcoal-soft">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-md border px-3 py-2 text-sm ${
                        m.senderId === selected.id
                          ? 'border-charcoal/10 bg-canvas-soft text-charcoal'
                          : 'ml-auto border-glove/20 bg-glove/10 text-charcoal'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="mt-1 text-[10px] text-charcoal-soft">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 border-t border-charcoal/10 pt-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message"
                  className="min-w-0 flex-1 rounded-md border border-charcoal/20 bg-canvas px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-glove"
                  maxLength={2000}
                />
                <Button type="submit" variant="primary" disabled={!draft.trim()}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-charcoal-soft">
              Select a friend to start messaging.
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function FriendList({
  title,
  empty,
  friendships,
  selectedId,
  onSelect,
}: {
  title: string;
  empty: string;
  friendships: Friendship[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{title}</h2>
      {friendships.length === 0 ? (
        <p className="text-sm text-charcoal-soft">{empty}</p>
      ) : (
        <div className="space-y-2">
          {friendships.map((f) =>
            f.friend ? (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect?.(f.friend!.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === f.friend.id
                    ? 'border-glove/30 bg-glove/10 text-glove'
                    : 'border-charcoal/10 bg-canvas hover:border-charcoal/30'
                }`}
              >
                <span>{f.friend.handle}</span>
                {f.status === 'pending' ? (
                  <span className="text-xs text-charcoal-soft">{f.direction}</span>
                ) : null}
              </button>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function RequestList({
  title,
  friendships,
  onRespond,
}: {
  title: string;
  friendships: Friendship[];
  onRespond: (id: string, action: 'accept' | 'decline') => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{title}</h2>
      {friendships.length === 0 ? (
        <p className="text-sm text-charcoal-soft">No incoming requests.</p>
      ) : (
        <div className="space-y-2">
          {friendships.map((f) =>
            f.friend ? (
              <div key={f.id} className="rounded-md border border-charcoal/10 bg-canvas p-3">
                <div className="mb-2 text-sm text-charcoal">{f.friend.handle}</div>
                <div className="flex gap-2">
                  <Button type="button" variant="primary" onClick={() => onRespond(f.id, 'accept')}>
                    Accept
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => onRespond(f.id, 'decline')}>
                    Decline
                  </Button>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}
