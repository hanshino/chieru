FROM node:lts as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile && \
  npm i -g typescript

COPY . .

RUN yarn build

FROM node:slim

# Create app directory
WORKDIR /app

# node:slim has no yarn baked in; corepack (bundled since Node 16.10) provides it.
RUN corepack enable

# Install app dependencies
COPY package.json yarn.lock ./

RUN yarn install --production --frozen-lockfile

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
CMD [ "yarn", "start" ]