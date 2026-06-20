"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/page-header";
import { formatDate, truncate } from "@/lib/utils";

interface Blog {
  id: string;
  title: string;
  status: string;
  evalScore: number | null;
  excerpt: string | null;
  topicTitle: string | null;
  hasHero: boolean;
  ghostUrl: string | null;
  updatedAt: string;
}

export function BlogsList({ initial }: { initial: Blog[] }) {
  if (initial.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="No blogs yet"
        description="Generate a draft from the Topics page; it will appear here for review and publishing."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {initial.map((b) => (
        <Link key={b.id} href={`/blogs/${b.id}`}>
          <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
            <div className="flex aspect-[1200/630] items-center justify-center bg-zinc-100">
              {b.hasHero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/blogs/${b.id}/hero`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm text-[var(--color-muted)]">
                  No hero image
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge status={b.status} />
                {typeof b.evalScore === "number" && (
                  <Badge tone="accent">
                    {(b.evalScore * 100).toFixed(0)}/100
                  </Badge>
                )}
              </div>
              <h3 className="font-medium text-zinc-900">{b.title}</h3>
              {b.excerpt && (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {truncate(b.excerpt, 110)}
                </p>
              )}
              <div className="mt-auto pt-3 text-xs text-[var(--color-muted)]">
                Updated {formatDate(b.updatedAt)}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
