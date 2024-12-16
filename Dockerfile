FROM node:20-slim

WORKDIR /code
COPY . .

RUN apt-get update && apt-get install -y gnupg && \
    apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 648ACFD622F3D138 F0235973A478C4D3 || \
    true && apt-get update

RUN cd client && npm install && cd ../server && npm install && npx playwright install-deps && npx playwright install
RUN npm run prepareSettings

RUN echo -e "\nBuilding the UI. This might take a couple of minutes...\n"
RUN cd client && npm run build

EXPOSE 4018
EXPOSE 4019

ENTRYPOINT ["./entrypoint.sh"]
