"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

export function CollectionFilterForm({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function applyForm(form: HTMLFormElement) {
    const params = new URLSearchParams();
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      const stringValue = String(value).trim();
      if (!stringValue) continue;
      if (key === "listed" && stringValue !== "true") continue;
      params.append(key, stringValue);
    }

    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
    window.setTimeout(() => router.refresh(), 0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyForm(event.currentTarget);
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== "checkbox") return;
    applyForm(event.currentTarget);
  }

  return (
    <form onChange={handleChange} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}

export function FilterBubbleLink({ children, href }: { children: ReactNode; href: string }) {
  const router = useRouter();
  const [isPopping, setIsPopping] = useState(false);

  return (
    <Link
      className={`filterBubble ${isPopping ? "isPopping" : ""}`}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        setIsPopping(true);
        window.setTimeout(() => {
          router.replace(href, { scroll: false });
          window.setTimeout(() => router.refresh(), 0);
        }, 180);
      }}
      scroll={false}
    >
      {children}
    </Link>
  );
}

export function ClientSortLink({ children, href }: { children: ReactNode; href: string }) {
  const router = useRouter();

  return (
    <Link
      href={href}
      onClick={(event) => {
        event.preventDefault();
        router.replace(href, { scroll: false });
        window.setTimeout(() => router.refresh(), 0);
      }}
      scroll={false}
    >
      {children}
    </Link>
  );
}
