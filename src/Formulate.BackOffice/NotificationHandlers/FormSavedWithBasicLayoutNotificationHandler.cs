﻿using Formulate.Core.Forms;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Layouts;
using Formulate.Core.Notifications;
using Formulate.Core.Utilities;
using System;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Strings;
using Umbraco.Extensions;
using System.Collections.Generic;
using Formulate.BackOffice.Definitions.Forms;
using Formulate.Core.Types;

namespace Formulate.BackOffice.NotificationHandlers
{
    public sealed class FormSavedWithBasicLayoutNotificationHandler : INotificationHandler<EntitySavedNotification<PersistedForm>>
    {
        private readonly FormDefinitionCollection _formDefinitions;

        private readonly ILayoutEntityRepository _layoutEntityRepository;

        private readonly IJsonUtility _jsonUtility;

        private readonly IShortStringHelper _shortStringHelper;

        public FormSavedWithBasicLayoutNotificationHandler(FormDefinitionCollection formDefinitions, IShortStringHelper shortStringHelper, ILayoutEntityRepository layoutEntityRepository, IJsonUtility jsonUtility)
        {
            _formDefinitions = formDefinitions;
            _shortStringHelper = shortStringHelper;
            _layoutEntityRepository = layoutEntityRepository;
            _jsonUtility = jsonUtility;
        }

        public void Handle(EntitySavedNotification<PersistedForm> notification)
        {
            var entity = notification.Entity;

            if (entity is null)
            {
                return;
            }

            var formDefinition = _formDefinitions.FirstOrDefault(entity.KindId);

            if (formDefinition is not FormWithBasicLayoutDefinition)
            {
                return;
            }

            var layoutName = $"{entity.Name} (Autogenerated)";
            var layoutAlias = layoutName.ToSafeAlias(_shortStringHelper, true);
            var layoutId = Guid.NewGuid();
            var layoutPath = new List<Guid>(entity.Path);
            layoutPath.Add(layoutId);

            var config = new BasicLayoutConfiguration()
            {
                AutoPopulate = true
            };

            var layout = new PersistedLayout()
            {
                Id = layoutId,
                Path = layoutPath.ToArray(),
                KindId = Guid.Parse(BasicLayoutDefinition.Constants.KindId),
                TemplateId = Guid.Parse("F3FB1485C1D14806B4190D7ABDE39530"), // replace with config value.
                Name = layoutName,
                Alias = layoutAlias,
                Data = _jsonUtility.Serialize(config)
            };

            _layoutEntityRepository.Save(layout);
        }
    }
}
