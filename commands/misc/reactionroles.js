/**
 * @file Interactive reaction role creator
 */

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

/**
 * Helper: ask a question and wait for the command author to reply
 */
async function ask(channel, author, question, time = 60000) {
  await channel.send(question);
  try {
    const collected = await channel.awaitMessages({
      filter: (m) => m.author.id === author.id,
      max: 1,
      time,
      errors: ["time"],
    });
    return collected.first();
  } catch (err) {
    return null;
  }
}

module.exports = {
  name: "reactionroles",
  description: "Create an embed reaction-role menu interactively.",
  guildOnly: true,

  async execute(message) {
    const { channel, author, guild, member } = message;

    if (!guild) return message.reply({ content: "This command can only be used in a server." });

    // Permissions check for user
    if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles) && !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply({ content: "You need the `Manage Roles` permission to create reaction roles." });
    }

    // Bot permissions
    const me = guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles) || !me.permissions.has(PermissionsBitField.Flags.AddReactions) || !me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply({ content: "I need `Manage Roles`, `Add Reactions` and `Manage Messages` permissions to create reaction roles." });
    }

    // Ask for embed title
    const titleMsg = await ask(channel, author, "Please enter the embed title (or type `none` for no title):");
    if (!titleMsg) return channel.send({ content: "Timed out. Please run the command again when ready." });
    const title = titleMsg.content.trim().toLowerCase() === "none" ? null : titleMsg.content.trim();

    // Ask for embed description
    const descMsg = await ask(channel, author, "Please enter the embed description (or type `none` for no description):");
    if (!descMsg) return channel.send({ content: "Timed out. Please run the command again when ready." });
    const description = descMsg.content.trim().toLowerCase() === "none" ? null : descMsg.content.trim();

    // Ask for embed color
    const colorMsg = await ask(channel, author, "Enter an embed color (hex like `#00FF00`) or type `none` to use default:");
    if (!colorMsg) return channel.send({ content: "Timed out. Please run the command again when ready." });
    let color = colorMsg.content.trim();
    if (color.toLowerCase() === "none") color = null;

    await channel.send(
      "Now send emoji and role pairs, one per message. Examples: `😄 @Role`, `<:custom:123456> @Role`, or `😄 RoleName`.\nWhen finished, type `done`. Type `cancel` to abort."
    );

    const mappings = [];
    while (true) {
      const pairMsg = await ask(channel, author, "Send an emoji and a role (or `done` / `cancel`):", 120000);
      if (!pairMsg) return channel.send({ content: "Timed out. Please run the command again when ready." });
      const txt = pairMsg.content.trim();
      if (txt.toLowerCase() === "cancel") return channel.send({ content: "Cancelled reaction role setup." });
      if (txt.toLowerCase() === "done") break;

      // parse: split by space, first token emoji, rest is role
      const parts = txt.split(/\s+/);
      if (parts.length < 2) {
        await channel.send({ content: "Invalid format. Please send `emoji @Role` or `emoji RoleName`." });
        continue;
      }
      const emojiInput = parts[0];
      const rolePart = parts.slice(1).join(" ");

      // try mentions first
      let role = pairMsg.mentions.roles.first();
      if (!role) {
        // try by name
        role = guild.roles.cache.find((r) => r.name.toLowerCase() === rolePart.toLowerCase());
      }
      if (!role) {
        await channel.send({ content: `Role not found: ${rolePart}. Try again.` });
        continue;
      }

      // check role position (bot can manage)
      if (role.position >= me.roles.highest.position) {
        await channel.send({ content: `I cannot manage the role ${role.name} because it's higher or equal to my highest role.` });
        continue;
      }

      mappings.push({ emoji: emojiInput, role });
      await channel.send({ content: `Added mapping: ${emojiInput} -> ${role.name}` });
    }

    if (mappings.length === 0) return channel.send({ content: "No mappings provided. Aborting." });

    // Build embed
    const embed = new EmbedBuilder();
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (color) embed.setColor(color);
    else embed.setColor("Random");

    // Add fields for mappings
    embed.addFields(
      mappings.map((m) => ({ name: `${m.emoji}`, value: `${m.role}`, inline: true }))
    );

    const sent = await channel.send({ embeds: [embed] });

    // React with emojis
    for (const m of mappings) {
      try {
        await sent.react(m.emoji);
      } catch (err) {
        console.error(`Failed to react with ${m.emoji}:`, err);
        await channel.send({ content: `Warning: failed to react with ${m.emoji}. Make sure the emoji is valid and I have access to it.` });
      }
    }

    // Create collector to handle add/remove
    const filter = (reaction, user) => !user.bot && mappings.some((mp) => mp.emoji === reaction.emoji.toString());
    const collector = sent.createReactionCollector({ filter, dispose: true });

    collector.on("collect", async (reaction, user) => {
      try {
        const map = mappings.find((m) => m.emoji === reaction.emoji.toString());
        if (!map) return;
        const guildMember = await guild.members.fetch(user.id).catch(() => null);
        if (!guildMember) return;
        if (!guildMember.roles.cache.has(map.role.id)) {
          await guildMember.roles.add(map.role).catch((e) => console.error(e));
        }
      } catch (e) {
        console.error(e);
      }
    });

    // 'dispose' is emitted when a reaction is removed if dispose:true
    collector.on("dispose", async (reaction, user) => {
      try {
        const map = mappings.find((m) => m.emoji === reaction.emoji.toString());
        if (!map) return;
        const guildMember = await guild.members.fetch(user.id).catch(() => null);
        if (!guildMember) return;
        if (guildMember.roles.cache.has(map.role.id)) {
          await guildMember.roles.remove(map.role).catch((e) => console.error(e));
        }
      } catch (e) {
        console.error(e);
      }
    });

    channel.send({ content: "Reaction role message created and collector started." });
  },
};
