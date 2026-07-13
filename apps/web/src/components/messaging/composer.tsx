import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

// A lightweight custom textarea rather than the shared <Textarea> (which
// always renders a visible field label meant for forms) — same tokens/focus
// styling, just shaped for a chat composer (single row that grows, Enter to
// send).
export const MessageComposer = forwardRef<HTMLTextAreaElement, MessageComposerProps>(
  ({ value, onChange, onSend, disabled }, ref) => {
    const canSend = value.trim().length > 0 && !disabled;

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (canSend) onSend();
      }
    }

    return (
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSend();
        }}
      >
        <label htmlFor="message-composer" className="sr-only">
          Mensagem
        </label>
        <textarea
          ref={ref}
          id="message-composer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Escreva uma mensagem..."
          className={cn(
            "max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5 text-base text-ink placeholder:text-muted",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <Button type="submit" size="md" disabled={!canSend}>
          Enviar
        </Button>
      </form>
    );
  },
);
MessageComposer.displayName = "MessageComposer";
