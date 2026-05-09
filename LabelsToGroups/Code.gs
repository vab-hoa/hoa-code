const DOMAIN = "villasboulders.org";
const ADMIN_EMAIL = "admin@villasboulders.org";

const SYNC_LIST = [
  { label: "Boulder Circle", prefix: "bouldercircle" },
  { label: "Boulder Point", prefix: "boulderpoint" },
  { label: "Broadlands Lane", prefix: "broadlandslane" },
  { label: "Plaster Point", prefix: "plasterpoint" },
  { label: "Rock Point", prefix: "rockpoint" },
  { label: "Stone Circle", prefix: "stonecircle" }, 
  { label: "LBC", prefix: "lbc" },
  { label: "lbc-workgroup", prefix: "lbc-workgroup" },
  { label: "non-occupant owner", prefix: "nonoccupantowner" },
  { label: "non-owner occupant", prefix: "nonowneroccupant" },
  { label: "owner-occupant", prefix: "owneroccupant" },
  { label: "volunteers", prefix: "volunteers" },
  { label: "Snow Squad", prefix: "snowsquad" },
  { label: "ARC", prefix: "arc"}
];

function executeCommunitySync() {
  const allContactGroups = People.ContactGroups.list();
  const contactGroups = (allContactGroups && allContactGroups.contactGroups) || [];

  SYNC_LIST.forEach(item => {
    const groupEmail = `${item.prefix}@${DOMAIN}`;

    try {
      AdminDirectory.Groups.get(groupEmail);
    } catch (e) {
      AdminDirectory.Groups.insert({ email: groupEmail, name: item.label });
    }

    try {
      AdminGroupsSettings.Groups.patch({
        whoCanJoin: "INVITED_CAN_JOIN",
        whoCanViewConversation: "ANYONE_CAN_VIEW",
        whoCanPostMessage: "ANYONE_CAN_POST",
        allowExternalMembers: "true"
      }, groupEmail);
    } catch (e) { console.warn("Settings error: " + groupEmail); }

    try {
      AdminDirectory.Members.insert({ email: ADMIN_EMAIL, role: "OWNER" }, groupEmail);
    } catch (e) {}

    syncLabelMembers(item.label, groupEmail, contactGroups);
  });
  console.log("Batch complete.");
}

function syncLabelMembers(labelName, groupEmail, contactGroups) {
  const targetLabel = contactGroups.find(g => g.name === labelName);

  if (!targetLabel) return;

  const membersList = People.ContactGroups.get(targetLabel.resourceName, { maxMembers: 1000 });
  if (!membersList.memberResourceNames) return;

  console.log(`Processing ${labelName}...`);

  const resourceNames = membersList.memberResourceNames;
  const BATCH_SIZE = 10;

  for (let i = 0; i < resourceNames.length; i += BATCH_SIZE) {
    Utilities.sleep(1000); // 1 second between batches → max 60 contact-reads/min, well under quota
    const batch = resourceNames.slice(i, i + BATCH_SIZE);
    try {
      const response = People.People.getBatchGet({
        resourceNames: batch,
        personFields: 'emailAddresses'
      });
      (response.responses || []).forEach(r => {
        const person = r.person;
        if (person && person.emailAddresses && person.emailAddresses.length > 0) {
          const email = person.emailAddresses[0].value;
          try {
            AdminDirectory.Members.insert({ email, role: 'MEMBER' }, groupEmail);
            console.log(`Added: ${email}`);
          } catch (e) { /* Already a member */ }
        }
      });
    } catch (e) {
      console.error(`Batch error for ${labelName} (batch ${i}): ${e.message}`);
    }
  }
}
