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

# node:slim ships npm but not yarn/corepack, so use npm here instead of
# reaching for yarn just to install already-locked production deps.
COPY package.json yarn.lock ./

RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
CMD [ "node", "dist/index.js" ]