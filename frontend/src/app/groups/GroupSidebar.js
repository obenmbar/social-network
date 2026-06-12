"use client";

import { MaxGroupDescriptionLen, MaxGroupInviteesLen, MaxGroupTitleLen } from "@/lib/limits";
import styles from "./Groups.module.css";
import { InviteSuggestions } from "./groupHelpers";

export default function GroupSidebar({
  groups,
  selectedGroupId,
  isLoading,
  invitations,
  drafts,
  activeInviteField,
  createInviteSuggestions,
  onGroupSelect,
  onDraftChange,
  onCreateInviteChange,
  onFocusInviteField,
  onClearActiveInviteField,
  onCreateGroup,
  onSelectCreateInvite,
  onInvitationResponse,
}) {
  return (
    <aside className={styles.sidebar}>
      <section className={styles.panel}>
        <h1>Groups</h1>
        {isLoading ? (
          <p className={styles.muted}>Loading groups...</p>
        ) : groups.length === 0 ? (
          <p className={styles.muted}>No groups yet.</p>
        ) : (
          <div className={styles.groupList}>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={group.id === selectedGroupId ? styles.activeGroup : ""}
                onClick={() => onGroupSelect(group.id)}
              >
                <strong>{group.title}</strong>
                <span>{group.member_count} members</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Create Group</h2>
        <form className={styles.stackForm} onSubmit={onCreateGroup}>
          <input
            value={drafts.title}
            onChange={(event) => onDraftChange("title", event.target.value)}
            placeholder="Title"
            maxLength={MaxGroupTitleLen}
          />
          <textarea
            value={drafts.description}
            onChange={(event) => onDraftChange("description", event.target.value)}
            placeholder="Description"
            rows={3}
            maxLength={MaxGroupDescriptionLen}
          />
          <div className={styles.suggestField}>
            <input
              value={drafts.invitees}
              onFocus={() => onFocusInviteField("create", "invitees")}
              onBlur={() => setTimeout(onClearActiveInviteField, 120)}
              onChange={(event) => onCreateInviteChange(event.target.value)}
              placeholder="First Last, First Last"
              maxLength={MaxGroupInviteesLen}
            />
            {activeInviteField === "create" && createInviteSuggestions.length > 0 && (
              <InviteSuggestions users={createInviteSuggestions} onSelect={onSelectCreateInvite} />
            )}
          </div>
          <button type="submit">Create</button>
        </form>
      </section>

      {invitations.length > 0 && (
        <section className={styles.panel}>
          <h2>Invitations</h2>
          <div className={styles.invitationList}>
            {invitations.map((invitation) => (
              <div key={invitation.id} className={styles.requestRow}>
                <span>{invitation.group.title}</span>
                <div>
                  <button
                    type="button"
                    onClick={() => onInvitationResponse(invitation.group_id, "accepted")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => onInvitationResponse(invitation.group_id, "declined")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
