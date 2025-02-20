/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import DonateButton from "@components/DonateButton";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Heart } from "@components/Heart";
import { Devs } from "@utils/constants";
import IpcEvents from "@utils/IpcEvents";
import Logger from "@utils/Logger";
import { Margins } from "@utils/margins";
import { closeModal, Modals, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Forms } from "@webpack/common";

const CONTRIBUTOR_BADGE = "https://cdn.discordapp.com/attachments/1033680203433660458/1092089947126780035/favicon.png";

/** List of vencord contributor IDs */
const contributorIds: string[] = Object.values(Devs).map(d => d.id.toString());

const ContributorBadge: ProfileBadge = {
    tooltip: "Vencord Contributor",
    image: CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    props: {
        style: {
            borderRadius: "50%",
            transform: "scale(0.9)" // The image is a bit too big compared to default badges
        }
    },
    shouldShow: ({ user }) => contributorIds.includes(user.id),
    onClick: () => VencordNative.ipc.invoke(IpcEvents.OPEN_EXTERNAL, "https://github.com/Vendicated/Vencord")
};

const DonorBadges = {} as Record<string, Pick<ProfileBadge, "image" | "tooltip">>;

export default definePlugin({
    name: "BadgeAPI",
    description: "API to add badges to users.",
    authors: [Devs.Megu, Devs.Ven, Devs.TheSun],
    required: true,
    patches: [
        /* Patch the badges array */
        {
            find: "Messages.PROFILE_USER_BADGES,",
            replacement: {
                match: /&&((\i)\.push\({tooltip:\i\.\i\.Messages\.PREMIUM_GUILD_SUBSCRIPTION_TOOLTIP\.format.+?;)(?:return\s\i;?})/,
                replace: (_, m, badgeArray) => `&&${m} return Vencord.Api.Badges.inject(${badgeArray}, arguments[0]);}`,
            }
        },
        /* Patch the badge list component on user profiles */
        {
            find: "Messages.PROFILE_USER_BADGES,role:",
            replacement: [
                {
                    match: /src:(\i)\[(\i)\.key\],/g,
                    // <img src={badge.image ?? imageMap[badge.key]} {...badge.props} />
                    replace: (_, imageMap, badge) => `src: ${badge}.image ?? ${imageMap}[${badge}.key], ...${badge}.props,`
                },
                {
                    match: /children:function(?<=(\i)\.(?:tooltip|description),spacing:\d.+?)/g,
                    replace: "children:$1.component ? () => $self.renderBadgeComponent($1) : function"
                }
            ]
        }
    ],

    renderBadgeComponent: ErrorBoundary.wrap((badge: ProfileBadge & BadgeUserArgs) => {
        const Component = badge.component!;
        return <Component {...badge} />;
    }, { noop: true }),

    async start() {
        Vencord.Api.Badges.addBadge(ContributorBadge);
        const badges = await fetch("https://gist.githubusercontent.com/Vendicated/51a3dd775f6920429ec6e9b735ca7f01/raw/badges.csv").then(r => r.text());
        const lines = badges.trim().split("\n");
        if (lines.shift() !== "id,tooltip,image") {
            new Logger("BadgeAPI").error("Invalid badges.csv file!");
            return;
        }
        for (const line of lines) {
            const [id, tooltip, image] = line.split(",");
            DonorBadges[id] = { image, tooltip };
        }
    },

    addDonorBadge(badges: ProfileBadge[], userId: string) {
        const badge = DonorBadges[userId];
        if (badge) {
            badges.unshift({
                ...badge,
                position: BadgePosition.START,
                props: {
                    style: {
                        borderRadius: "50%",
                        transform: "scale(0.9)" // The image is a bit too big compared to default badges
                    }
                },
                onClick() {
                    const modalKey = openModal(props => (
                        <ErrorBoundary noop onError={() => {
                            closeModal(modalKey);
                            VencordNative.ipc.invoke(IpcEvents.OPEN_EXTERNAL, "https://github.com/sponsors/Vendicated");
                        }}>
                            <Modals.ModalRoot {...props}>
                                <Modals.ModalHeader>
                                    <Flex style={{ width: "100%", justifyContent: "center" }}>
                                        <Forms.FormTitle
                                            tag="h2"
                                            style={{
                                                width: "100%",
                                                textAlign: "center",
                                                margin: 0
                                            }}
                                        >
                                            <Heart />
                                            Vencord Donor
                                        </Forms.FormTitle>
                                    </Flex>
                                </Modals.ModalHeader>
                                <Modals.ModalContent>
                                    <Flex>
                                        <img
                                            role="presentation"
                                            src="https://cdn.discordapp.com/emojis/1026533070955872337.png"
                                            alt=""
                                            style={{ margin: "auto" }}
                                        />
                                        <img
                                            role="presentation"
                                            src="https://cdn.discordapp.com/emojis/1026533090627174460.png"
                                            alt=""
                                            style={{ margin: "auto" }}
                                        />
                                    </Flex>
                                    <div style={{ padding: "1em" }}>
                                        <Forms.FormText>
                                            This Badge is a special perk for Vencord Donors
                                        </Forms.FormText>
                                        <Forms.FormText className={Margins.top20}>
                                            Please consider supporting the development of Vencord by becoming a donor. It would mean a lot!!
                                        </Forms.FormText>
                                    </div>
                                </Modals.ModalContent>
                                <Modals.ModalFooter>
                                    <Flex style={{ width: "100%", justifyContent: "center" }}>
                                        <DonateButton />
                                    </Flex>
                                </Modals.ModalFooter>
                            </Modals.ModalRoot>
                        </ErrorBoundary>
                    ));
                },
            });
        }
    }
});
